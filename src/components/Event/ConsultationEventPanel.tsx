// PBS Admin - Consultation Event Panel Component
// Transcript management for consultation events

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileCheck, Loader2, FileText } from "lucide-react";
import type { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import { updateEvent } from "@/lib/services/eventService";
import { saveTranscriptFile } from "@/lib/services/transcriptFileService";
import { invoke } from "@tauri-apps/api/core";

export interface ConsultationEventPanelProps extends EventSpecificPanelProps {
  clientFolderPath?: string;
  clientName?: string;
  onClose?: () => void;
}

export function ConsultationEventPanel({
  clientId,
  event,
  clientFolderPath,
  clientName
}: ConsultationEventPanelProps) {
  const queryClient = useQueryClient();

  // Track transcript text and editing state
  const [transcriptText, setTranscriptText] = useState("");
  const [isEditing, setIsEditing] = useState(!event?.transcriptFilePath);

  // Track available txt files in client folder
  const [txtFiles, setTxtFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>(event?.transcriptFilePath || "");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load txt files from client folder
  useEffect(() => {
    const loadTxtFiles = async () => {
      if (!clientFolderPath) return;

      try {
        const entries = await invoke<Array<{ name: string; isDirectory: boolean }>>(
          "plugin:fs|read_dir",
          { path: clientFolderPath }
        );

        // Filter for .txt files only
        const files = entries
          .filter(entry => !entry.isDirectory && entry.name.endsWith('.txt'))
          .map(entry => ({
            name: entry.name,
            path: `${clientFolderPath}\\${entry.name}`
          }))
          .sort((a, b) => b.name.localeCompare(a.name)); // Sort newest first (by filename)

        setTxtFiles(files);

        // Set default selection to saved transcript if available
        if (event?.transcriptFilePath) {
          setSelectedFilePath(event.transcriptFilePath);
        } else if (files.length > 0) {
          setSelectedFilePath(files[0].path);
        }
      } catch (error) {
        console.error("Failed to load txt files:", error);
      }
    };

    loadTxtFiles();
  }, [clientFolderPath, event?.transcriptFilePath, refreshTrigger]);

  // Save transcript mutation
  const saveTranscriptMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId || !clientFolderPath || !clientName) {
        throw new Error("Cannot save transcript: Event not created or missing client info");
      }

      if (!transcriptText || transcriptText.trim().length < 10) {
        throw new Error("Transcript must be at least 10 characters");
      }

      // Extract client surname for filename
      const clientSurname = clientName.split(' ').pop() || clientName;

      // Use event.date (ISO format from database) or fall back to today's ISO string
      // The service will handle formatting for the filename
      const consultationDate = event.date || new Date().toISOString();

      // Save transcript file to client folder
      const result = await saveTranscriptFile(
        clientFolderPath,
        clientSurname.toLowerCase(),
        consultationDate,
        transcriptText
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to save transcript file");
      }

      // Update event with transcript file path
      await updateEvent(event.eventId, {
        transcriptFilePath: result.filePath
      });

      return { filePath: result.filePath, fileName: result.fileName };
    },
    onSuccess: () => {
      // Clear textarea and switch to confirmation view
      setTranscriptText("");
      setIsEditing(false);

      // Refresh txt files dropdown to show newly saved file
      setRefreshTrigger(prev => prev + 1);

      // Invalidate queries to refresh event data
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      alert(`Failed to save transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  const handleSaveTranscript = () => {
    // If replacing existing transcript, confirm first
    if (event?.transcriptFilePath) {
      if (!window.confirm("Are you sure you want to replace the existing transcript file?")) {
        return;
      }
    }

    saveTranscriptMutation.mutate();
  };

  const handleReplaceTranscript = () => {
    setIsEditing(true);
    setTranscriptText("");
  };

  // Extract filename from path for display
  const savedFileName = event?.transcriptFilePath
    ? event.transcriptFilePath.split('\\').pop() || event.transcriptFilePath.split('/').pop()
    : null;

  return (
    <div className="space-y-4">
      {/* Client Name Display */}
      <div className="pb-2 border-b">
        <p className="text-[10px] text-muted-foreground">Client</p>
        <p className="font-semibold text-xs">{clientName || 'Unknown Client'}</p>
      </div>

      {/* Folder Warning */}
      {!clientFolderPath && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
          <p className="text-[10px] text-amber-600">
            ⚠ Client folder not created - please create folder first
          </p>
        </div>
      )}

      {/* Event Not Saved Warning */}
      {!event?.eventId && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
          <p className="text-[10px] text-amber-600">
            ⚠ Please save the event first before saving transcript
          </p>
        </div>
      )}

      {/* Transcript Section */}
      <Card className="p-3">
        <h4 className="text-xs font-semibold mb-2">TRANSCRIPT</h4>

        {isEditing ? (
          // Editing mode - show textarea
          <div className="space-y-2">
            <Label htmlFor="transcript" className="text-[10px]">
              Paste Transcript
            </Label>
            <Textarea
              id="transcript"
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste consultation transcript here..."
              className="min-h-[200px] text-[11px] font-mono"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {transcriptText.length} characters
              </span>
              <Button
                size="sm"
                onClick={handleSaveTranscript}
                disabled={!transcriptText || transcriptText.trim().length < 10 || saveTranscriptMutation.isPending || !event?.eventId || !clientFolderPath}
                className="h-7 text-xs"
              >
                {saveTranscriptMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3 w-3 mr-1" />
                    Save Transcript
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Confirmation mode - show saved message and file selector
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <FileCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-green-800 font-medium">
                    Transcript saved
                  </p>
                  <p className="text-[10px] text-green-700 mt-1 break-all">
                    {savedFileName}
                  </p>
                </div>
              </div>
            </div>

            {/* Transcript file selector dropdown */}
            <div className="space-y-1">
              <Label className="text-[10px]">Transcript Files in Folder</Label>
              <Select
                value={selectedFilePath}
                onValueChange={setSelectedFilePath}
                disabled={txtFiles.length === 0}
              >
                <SelectTrigger className="h-8 text-[11px]">
                  <SelectValue placeholder={txtFiles.length === 0 ? "No txt files found" : "Select a transcript file"} />
                </SelectTrigger>
                <SelectContent>
                  {txtFiles.length === 0 ? (
                    <SelectItem value="none" disabled className="text-[11px] text-muted-foreground">
                      No txt files found
                    </SelectItem>
                  ) : (
                    txtFiles.map((file) => (
                      <SelectItem
                        key={file.path}
                        value={file.path}
                        className="text-[11px]"
                      >
                        {file.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceTranscript}
              className="h-7 text-xs w-full"
            >
              <FileText className="h-3 w-3 mr-1" />
              Replace Transcript
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
