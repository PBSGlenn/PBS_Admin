// PBS Admin - Report Generator Dialog Component
// Generate consultation reports and follow-up emails using Claude API

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { EmailDraftDialog } from "../ui/email-draft-dialog";
import { generateConsultationReport, estimateTokenCost, type GeneratedReport } from "@/lib/services/reportGenerationService";
import { createEvent } from "@/lib/services/eventService";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Send, Loader2, AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

export interface ReportGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  clientName: string;
  clientEmail: string;
  eventId: number;
  eventDate: string;
  petName: string;
  petSpecies: string;
  clientFolderPath?: string;
}

export function ReportGeneratorDialog({
  isOpen,
  onClose,
  clientId,
  clientName,
  clientEmail,
  eventId,
  eventDate,
  petName,
  petSpecies,
  clientFolderPath,
}: ReportGeneratorDialogProps) {
  const queryClient = useQueryClient();

  // State
  const [transcript, setTranscript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);

  // Format consultation date for display
  const formattedDate = format(new Date(eventDate), "dd/MM/yyyy");

  // Estimate cost
  const costEstimate = estimateTokenCost(transcript.length);

  // Handle file upload
  const handleFileUpload = async () => {
    try {
      const selected = await invoke<string[]>("plugin:dialog|open", {
        filters: [
          {
            name: "Text",
            extensions: ["txt", "md"],
          },
        ],
      });

      if (selected && selected.length > 0) {
        const content = await invoke<string>("plugin:fs|read_text_file", {
          path: selected[0],
        });
        setTranscript(content);
      }
    } catch (error) {
      console.error("Failed to read file:", error);
      setError(`Failed to read file: ${error}`);
    }
  };

  // Generate report using Claude API
  const handleGenerateReport = async () => {
    if (!transcript.trim()) {
      setError("Please provide a consultation transcript");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateConsultationReport({
        clientName,
        petName,
        petSpecies,
        consultationDate: formattedDate,
        transcript,
      });

      setGeneratedReport(result);
    } catch (err) {
      console.error("Failed to generate report:", err);
      setError(`Failed to generate report: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save report to client folder and create event
  const handleSaveReport = async () => {
    if (!generatedReport || !clientFolderPath) return;

    setIsSaving(true);
    setError(null);

    try {
      // Generate filename with timestamp
      const timestamp = format(new Date(), "yyyyMMdd-HHmmss");
      const reportFileName = `consultation-report-${timestamp}.md`;
      const reportFilePath = `${clientFolderPath}\\${reportFileName}`;

      // Save report as markdown file
      await invoke("write_text_file", {
        filePath: reportFilePath,
        content: generatedReport.report,
      });

      // Create "Report Sent" event
      await createEvent({
        clientId,
        eventType: "Note",
        date: new Date().toISOString(),
        notes: `<h2>Consultation Report Generated</h2><p><strong>File:</strong> ${reportFileName}</p><p><strong>Consultation Date:</strong> ${formattedDate}</p><p>Report generated using AI and saved to client folder.</p>`,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });

      // Open email draft
      setShowEmailDraft(true);
    } catch (err) {
      console.error("Failed to save report:", err);
      setError(`Failed to save report: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle email sent
  const handleEmailSent = () => {
    setShowEmailDraft(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showEmailDraft} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Generate Consultation Report</DialogTitle>
            <DialogDescription>
              Use AI to generate a professional consultation report and follow-up email
            </DialogDescription>
          </DialogHeader>

          {/* Consultation Info */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-md text-xs">
            <div>
              <span className="text-muted-foreground">Client:</span>{" "}
              <span className="font-medium">{clientName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pet:</span>{" "}
              <span className="font-medium">{petName} ({petSpecies})</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>{" "}
              <span className="font-medium">{formattedDate}</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {!generatedReport ? (
              // Step 1: Input transcript
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <Label htmlFor="transcript" className="text-xs">
                    Consultation Transcript
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFileUpload}
                    className="h-7 text-xs"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload .txt File
                  </Button>
                </div>

                <Textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste or upload the consultation transcript here..."
                  className="flex-1 font-mono text-[11px] resize-none"
                />

                {transcript && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{transcript.length.toLocaleString()} characters</span>
                    <span>
                      Est. ~{costEstimate.estimatedTokens.toLocaleString()} tokens
                      (${costEstimate.estimatedCostUSD.toFixed(4)} USD)
                    </span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-destructive">Error</p>
                      <p className="text-xs text-destructive/80 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    size="sm"
                    disabled={isGenerating}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleGenerateReport}
                    size="sm"
                    disabled={!transcript.trim() || isGenerating}
                    className="h-8 text-xs"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Generate Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // Step 2: Preview and save
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-1 text-[10px] text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Report generated successfully</span>
                </div>

                <Tabs defaultValue="report" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="report" className="text-xs">Report Preview</TabsTrigger>
                    <TabsTrigger value="email" className="text-xs">Follow-up Email</TabsTrigger>
                  </TabsList>

                  <TabsContent value="report" className="flex-1 overflow-auto mt-2">
                    <div className="prose prose-sm max-w-none p-4 border rounded-md bg-background">
                      <ReactMarkdown>{generatedReport.report}</ReactMarkdown>
                    </div>
                  </TabsContent>

                  <TabsContent value="email" className="flex-1 overflow-auto mt-2">
                    <div className="space-y-2 p-4 border rounded-md bg-background">
                      <div className="text-xs">
                        <span className="font-medium">Subject:</span> {generatedReport.followUpEmail.subject}
                      </div>
                      <div className="text-xs whitespace-pre-wrap">
                        {generatedReport.followUpEmail.body}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-destructive">Error</p>
                      <p className="text-xs text-destructive/80 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGeneratedReport(null)}
                    size="sm"
                    disabled={isSaving}
                    className="h-8 text-xs"
                  >
                    ← Back to Edit
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      size="sm"
                      disabled={isSaving}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveReport}
                      size="sm"
                      disabled={isSaving || !clientFolderPath}
                      className="h-8 text-xs"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          Save Report & Send Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {!clientFolderPath && (
                  <p className="text-[10px] text-destructive">
                    Client folder not created yet. Please create a folder before saving the report.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Draft Dialog */}
      {generatedReport && (
        <EmailDraftDialog
          isOpen={showEmailDraft}
          onClose={() => setShowEmailDraft(false)}
          onSend={handleEmailSent}
          initialTo={clientEmail}
          initialSubject={generatedReport.followUpEmail.subject}
          initialBody={generatedReport.followUpEmail.body}
          clientName={clientName}
        />
      )}
    </>
  );
}
