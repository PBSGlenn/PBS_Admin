/**
 * Audio Transcription Tool
 *
 * Standalone transcription service accessible via Settings menu.
 * Allows users to upload audio files, transcribe with speaker labels,
 * and save transcripts for use in consultation events.
 *
 * Supports files >25MB via FFmpeg compression/chunking.
 *
 * Flow:
 * 1. Upload audio file (.m4a, .mp3, .wav, .ogg, .flac)
 * 2. Configure options (speaker count, labels)
 * 3. Preview cost estimate
 * 4. Transcribe (OpenAI gpt-4o-transcribe-diarize)
 * 5. Preview/edit transcript
 * 6. Save to client folder or custom location
 */

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getAllClients } from "@/lib/services/clientService";
import {
  transcribeAudio,
  saveTranscript,
  getAudioDuration,
  estimateTranscriptionCost,
  getTranscriptionStats,
  updateTranscriptionStats,
  checkFFmpeg,
  type TranscriptionResult,
  type TranscriptionStats,
  type TranscriptionOptions,
  type TranscriptionProgressCallback
} from "@/lib/services/transcriptionService";
import { toast } from "sonner";
import { Loader2, Upload, FileAudio, DollarSign, Users, Save, Copy, FolderOpen, X, AlertTriangle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface TranscriptionToolProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_DIRECT_SIZE = 25 * 1024 * 1024; // 25MB — OpenAI API limit

export function TranscriptionTool({ isOpen, onClose }: TranscriptionToolProps) {
  // File handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioFilePath, setAudioFilePath] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration
  const [speakerCount, setSpeakerCount] = useState<number>(2);
  const [customLabels, setCustomLabels] = useState<string>("Vet, Client");
  const [language, setLanguage] = useState<string>("en");

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState<string>("");

  // Large file handling
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);

  // Cost estimation
  const [estimatedCost, setEstimatedCost] = useState<{ whisper: number; claude: number; total: number } | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  // Save options
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [customSavePath, setCustomSavePath] = useState<string>("");

  // Usage stats
  const [stats, setStats] = useState<TranscriptionStats>({ totalTranscriptions: 0, totalDuration: 0, totalCost: 0 });

  // Load transcription stats
  useEffect(() => {
    getTranscriptionStats().then(setStats);
  }, []);

  // Fetch clients for folder selection
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getAllClients
  });

  /**
   * Handle file selection
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/flac'];
    const validExtensions = ['.mp3', '.m4a', '.wav', '.mp4', '.ogg', '.flac'];
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      toast.error("Please select a valid audio file (.mp3, .m4a, .wav, .ogg, .flac)");
      return;
    }

    setSelectedFile(file);

    // Check if this is a large file (>25MB)
    const large = file.size > MAX_DIRECT_SIZE;
    setIsLargeFile(large);

    if (large) {
      // Check FFmpeg availability for large files
      const ffcheck = await checkFFmpeg();
      setFfmpegAvailable(ffcheck.available);
      if (!ffcheck.available) {
        toast.warning(
          "This file is larger than 25MB and requires FFmpeg for processing. Please install FFmpeg.",
          { duration: 8000 }
        );
      } else {
        const sizeMB = (file.size / 1_048_576).toFixed(1);
        toast.info(
          `Large file (${sizeMB} MB) — will use FFmpeg to compress/split before transcription.`,
          { duration: 5000 }
        );
      }
    }

    // Get duration for cost estimation
    try {
      const duration = await getAudioDuration(file);
      setAudioDuration(duration);

      const cost = estimateTranscriptionCost(duration);
      setEstimatedCost(cost);

      toast.success(`Audio loaded: ${formatDuration(duration)}`);
    } catch (error) {
      console.error("Error reading audio duration:", error);
      // For large files, browser Audio API may not load — that's okay
      if (!large) {
        toast.error("Could not read audio file duration");
      }
    }

    // Save file temporarily for Tauri to access
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Save to temp directory
      const tempPath = await invoke<string>("save_temp_audio_file", {
        fileName: file.name,
        fileData: Array.from(uint8Array)
      });

      setAudioFilePath(tempPath);
    } catch (error) {
      console.error("Error saving temp audio file:", error);
      toast.error("Failed to prepare audio file for transcription");
    }
  };

  /**
   * Handle transcription (with progress for chunked files)
   */
  const handleTranscribe = async () => {
    if (!selectedFile || !audioFilePath) {
      toast.error("Please select an audio file first");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionResult(null);
    setProgressMessage("");

    try {
      const options: TranscriptionOptions = {
        speakerCount,
        language,
        speakerLabels: customLabels.split(',').map(l => l.trim()).filter(Boolean)
      };

      // Progress callback for chunked transcription
      const onProgress: TranscriptionProgressCallback = (progress) => {
        let msg = progress.message;
        if (progress.current && progress.total && progress.total > 1) {
          msg = `${progress.message} (${progress.current}/${progress.total})`;
        }
        setProgressMessage(msg);
      };

      const result = await transcribeAudio(audioFilePath, options, onProgress);

      if (!result.success) {
        toast.error(result.error || "Transcription failed");
        return;
      }

      setTranscriptionResult(result);
      setEditedTranscript(result.speakerLabeledTranscript || "");

      // Update usage stats
      if (result.duration && result.cost) {
        await updateTranscriptionStats(result.duration, result.cost.total);
        getTranscriptionStats().then(setStats);
      }

      toast.success(
        <div>
          <div className="font-semibold">Transcription complete!</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Cost: ${result.cost?.total.toFixed(4)} USD
          </div>
        </div>
      );

    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Transcription failed. Please try again.");
    } finally {
      setIsTranscribing(false);
      setProgressMessage("");
    }
  };

  /**
   * Handle save to client folder
   */
  const handleSaveToClientFolder = async () => {
    if (!transcriptionResult?.speakerLabeledTranscript || !selectedClientId) {
      toast.error("Please select a client folder");
      return;
    }

    const client = clients.find(c => c.clientId === selectedClientId);
    if (!client || !client.folderPath) {
      toast.error("Selected client does not have a folder created");
      return;
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `transcript_${timestamp}.txt`;
    const filePath = `${client.folderPath}\\${fileName}`;

    const result = await saveTranscript(editedTranscript, filePath);

    if (result.success) {
      toast.success(
        <div>
          <div className="font-semibold">Transcript saved!</div>
          <div className="text-[10px] text-muted-foreground mt-1">{fileName}</div>
        </div>
      );
    } else {
      toast.error(result.error || "Failed to save transcript");
    }
  };

  /**
   * Handle save to custom location
   */
  const handleSaveToCustomPath = async () => {
    if (!transcriptionResult?.speakerLabeledTranscript) {
      toast.error("No transcript to save");
      return;
    }

    try {
      // Open save dialog
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        defaultPath: "transcript.txt",
        filters: [{
          name: "Text Files",
          extensions: ["txt"]
        }]
      });

      if (!filePath) return; // User cancelled

      const result = await saveTranscript(editedTranscript, filePath);

      if (result.success) {
        toast.success("Transcript saved successfully");
        setCustomSavePath(filePath);
      } else {
        toast.error(result.error || "Failed to save transcript");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save transcript");
    }
  };

  /**
   * Copy transcript to clipboard
   */
  const handleCopyToClipboard = () => {
    if (!editedTranscript) {
      toast.error("No transcript to copy");
      return;
    }

    navigator.clipboard.writeText(editedTranscript);
    toast.success("Transcript copied to clipboard");
  };

  /**
   * Reset tool
   */
  const handleReset = () => {
    setSelectedFile(null);
    setAudioFilePath("");
    setTranscriptionResult(null);
    setEditedTranscript("");
    setEstimatedCost(null);
    setAudioDuration(null);
    setSelectedClientId(null);
    setCustomSavePath("");
    setIsLargeFile(false);
    setFfmpegAvailable(null);
    setProgressMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Format duration in seconds to MM:SS
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Clients with folders
  const clientsWithFolders = clients.filter(c => c.folderPath);

  // Can transcribe: file selected, and if large file, FFmpeg must be available
  const canTranscribe = !!audioFilePath && (!isLargeFile || ffmpegAvailable === true);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Audio Transcription Tool
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Usage Stats */}
          {stats.totalTranscriptions > 0 && (
            <div className="bg-muted/50 p-3 rounded-md space-y-1">
              <div className="text-[11px] font-medium">Usage Statistics</div>
              <div className="flex gap-4 text-[10px] text-muted-foreground">
                <div>Total: {stats.totalTranscriptions} transcriptions</div>
                <div>Duration: {formatDuration(stats.totalDuration)}</div>
                <div>Cost: ${stats.totalCost.toFixed(2)} USD</div>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Audio File</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.m4a,.wav,.mp4,.ogg,.flac,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="h-9"
                disabled={isTranscribing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {selectedFile ? "Change File" : "Select Audio File"}
              </Button>
              {selectedFile && (
                <div className="flex-1 flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/30">
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[11px] truncate">{selectedFile.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {(selectedFile.size / 1_048_576).toFixed(1)} MB
                  </Badge>
                  {audioDuration && (
                    <Badge variant="outline" className="text-[10px]">
                      {formatDuration(audioDuration)}
                    </Badge>
                  )}
                  {isLargeFile && (
                    <Badge variant="secondary" className="text-[10px]">
                      FFmpeg
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Large file warning */}
          {isLargeFile && ffmpegAvailable === false && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="text-[11px] font-medium text-amber-900 dark:text-amber-100">
                    FFmpeg Required
                  </div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-300">
                    This file exceeds the 25MB API limit and needs FFmpeg to compress/split before transcription.
                    Install FFmpeg from <strong>ffmpeg.org</strong> and ensure it's in your system PATH.
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLargeFile && ffmpegAvailable === true && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3 rounded-md">
              <div className="text-[10px] text-blue-700 dark:text-blue-300">
                Large file detected. FFmpeg will compress and split the audio into chunks for transcription.
                This may take longer than usual.
              </div>
            </div>
          )}

          {/* Configuration */}
          {selectedFile && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="speaker-count" className="text-[10px] uppercase text-muted-foreground">
                  Number of Speakers
                </Label>
                <Select
                  value={speakerCount.toString()}
                  onValueChange={(value) => {
                    const count = parseInt(value);
                    setSpeakerCount(count);
                    // Update default labels
                    const defaultLabels: Record<number, string> = {
                      2: "Vet, Client",
                      3: "Vet, Client, Partner",
                      4: "Vet, Client, Partner, Family Member",
                    };
                    setCustomLabels(defaultLabels[count] || "Vet, Client");
                  }}
                  disabled={isTranscribing}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 speakers</SelectItem>
                    <SelectItem value="3">3 speakers</SelectItem>
                    <SelectItem value="4">4 speakers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-labels" className="text-[10px] uppercase text-muted-foreground">
                  Speaker Labels (comma-separated)
                </Label>
                <Input
                  id="custom-labels"
                  value={customLabels}
                  onChange={(e) => setCustomLabels(e.target.value)}
                  placeholder="Vet, Client, Partner"
                  className="h-9"
                  disabled={isTranscribing}
                />
              </div>
            </div>
          )}

          {/* Cost Estimate */}
          {estimatedCost && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3 rounded-md">
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="text-[11px] font-medium text-blue-900 dark:text-blue-100">
                    Estimated Cost
                  </div>
                  <div className="text-[10px] text-blue-700 dark:text-blue-300">
                    Transcription (with speaker diarization): <strong>${estimatedCost.total.toFixed(4)} USD</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transcribe Button */}
          {selectedFile && !transcriptionResult && (
            <div className="space-y-2">
              <Button
                onClick={handleTranscribe}
                disabled={isTranscribing || !canTranscribe}
                className="w-full"
                size="lg"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {progressMessage || "Transcribing... (this may take 1-2 minutes)"}
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Transcribe with Speaker Labels
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Transcription Result */}
          {transcriptionResult && (
            <Tabs defaultValue="labeled" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="labeled">Speaker-Labeled Transcript</TabsTrigger>
                <TabsTrigger value="raw">Raw Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="labeled" className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Editable Transcript (review and fix any errors)
                  </Label>
                  <Textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="min-h-[300px] font-mono text-[11px]"
                    placeholder="Labeled transcript will appear here..."
                  />
                </div>

                {/* Save Options */}
                <div className="space-y-3 pt-3 border-t">
                  <div className="text-[11px] font-medium">Save Transcript</div>

                  {/* Save to Client Folder */}
                  <div className="flex gap-2">
                    <Select
                      value={selectedClientId?.toString() || ""}
                      onValueChange={(value) => setSelectedClientId(parseInt(value))}
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Select client folder..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsWithFolders.map(client => (
                          <SelectItem key={client.clientId} value={client.clientId.toString()}>
                            {client.firstName} {client.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSaveToClientFolder}
                      disabled={!selectedClientId}
                      variant="outline"
                      className="h-9"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save to Client Folder
                    </Button>
                  </div>

                  {/* Save to Custom Location */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveToCustomPath}
                      variant="outline"
                      className="h-9"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Save to Custom Location
                    </Button>
                    <Button
                      onClick={handleCopyToClipboard}
                      variant="outline"
                      className="h-9"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </Button>
                  </div>

                  {customSavePath && (
                    <div className="text-[10px] text-muted-foreground">
                      Saved to: {customSavePath}
                    </div>
                  )}
                </div>

                {/* Actual Cost */}
                {transcriptionResult.cost && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3 rounded-md">
                    <div className="text-[11px] font-medium text-green-900 dark:text-green-100">
                      Actual Cost: ${transcriptionResult.cost.total.toFixed(4)} USD
                    </div>
                    <div className="text-[10px] text-green-700 dark:text-green-300 mt-1">
                      Transcription with speaker diarization (gpt-4o-transcribe-diarize)
                    </div>
                  </div>
                )}

                {/* New Transcription Button */}
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Start New Transcription
                </Button>
              </TabsContent>

              <TabsContent value="raw" className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Raw Transcript (no speaker labels)
                  </Label>
                  <Textarea
                    value={transcriptionResult.rawTranscript || ""}
                    readOnly
                    className="min-h-[300px] font-mono text-[11px] bg-muted/30"
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
