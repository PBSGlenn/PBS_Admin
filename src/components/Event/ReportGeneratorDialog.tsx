// PBS Admin - Report Generator Dialog Component
// Generate consultation reports using Claude API

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { generateConsultationReport, estimateTokenCost } from "@/lib/services/reportGenerationService";
import { createEvent } from "@/lib/services/eventService";
import { createTask } from "@/lib/services/taskService";
import { convertReportToDocx, checkTemplateExists } from "@/lib/services/docxConversionService";
import { convertReportToPdf } from "@/lib/services/pdfConversionService";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readDir } from "@tauri-apps/plugin-fs";
import { FileText, Loader2, AlertCircle, CheckCircle2, Upload, FolderOpen, FileType } from "lucide-react";
import { format, addDays } from "date-fns";
import { dateToISO } from "@/lib/utils/dateUtils";

export interface ReportGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  clientName: string;
  clientSurname: string;
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
  clientSurname,
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number>(1);
  const [isConvertingDocx, setIsConvertingDocx] = useState(false);
  const [docxFilePath, setDocxFilePath] = useState<string | null>(null);
  const [docxFileName, setDocxFileName] = useState<string | null>(null);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [pdfFilePath, setPdfFilePath] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);

  // Format consultation date for display
  const formattedDate = format(new Date(eventDate), "dd/MM/yyyy");
  const dateForFilename = format(new Date(eventDate), "yyyyMMdd");

  // Estimate cost
  const costEstimate = estimateTokenCost(transcript.length);

  // Detect next version number
  const getNextVersionNumber = async (): Promise<number> => {
    if (!clientFolderPath) return 1;

    try {
      const files = await readDir(clientFolderPath);
      const reportFiles = files.filter(f =>
        f.name.startsWith(`${clientSurname.toLowerCase()}_${dateForFilename}_consultation-report_v`) &&
        f.name.endsWith('.md')
      );

      if (reportFiles.length === 0) return 1;

      // Extract version numbers from filenames
      const versions = reportFiles.map(f => {
        const match = f.name.match(/_v(\d+)\.md$/);
        return match ? parseInt(match[1]) : 0;
      });

      return Math.max(...versions) + 1;
    } catch (error) {
      console.error("Failed to detect version:", error);
      return 1;
    }
  };

  // Check for existing MD/DOCX/PDF files when dialog opens
  const checkForExistingReport = async () => {
    if (!clientFolderPath) return;

    try {
      const files = await readDir(clientFolderPath);
      const searchPattern = `${clientSurname.toLowerCase()}_${dateForFilename}_consultation-report_v`;
      const pdfSearchPattern = `${petName}_Consultation_Report_`;

      // Find MD files
      const reportFiles = files.filter(f =>
        f.name.startsWith(searchPattern) &&
        f.name.endsWith('.md')
      );

      if (reportFiles.length > 0) {
        // Find the most recent version
        const filesWithVersions = reportFiles.map(f => {
          const match = f.name.match(/_v(\d+)\.md$/);
          const version = match ? parseInt(match[1]) : 0;
          return { file: f, version };
        });

        filesWithVersions.sort((a, b) => b.version - a.version);
        const latestFile = filesWithVersions[0];

        // Set MD file state
        const mdFilePath = `${clientFolderPath}\\${latestFile.file.name}`;
        setSavedFilePath(mdFilePath);
        setSavedFileName(latestFile.file.name);
        setSavedVersion(latestFile.version);

        // Check for corresponding DOCX file
        const docxFileName = latestFile.file.name.replace('.md', '.docx');
        const docxFile = files.find(f => f.name === docxFileName);

        if (docxFile) {
          const docxFilePath = `${clientFolderPath}\\${docxFile.name}`;
          setDocxFilePath(docxFilePath);
          setDocxFileName(docxFile.name);

          // Check for corresponding PDF file (client-friendly name)
          const pdfFile = files.find(f =>
            f.name.startsWith(pdfSearchPattern) &&
            f.name.endsWith('.pdf')
          );

          if (pdfFile) {
            const pdfFilePath = `${clientFolderPath}\\${pdfFile.name}`;
            setPdfFilePath(pdfFilePath);
            setPdfFileName(pdfFile.name);
          }
        }
      }
    } catch (error) {
      console.error("Failed to check for existing report:", error);
    }
  };

  // Check for existing report when dialog opens
  useEffect(() => {
    if (isOpen) {
      checkForExistingReport();
    } else {
      // Reset state when dialog closes
      setTranscript("");
      setSavedFilePath(null);
      setSavedFileName(null);
      setError(null);
      setDocxFilePath(null);
      setDocxFileName(null);
      setPdfFilePath(null);
      setPdfFileName(null);
    }
  }, [isOpen]);

  // Handle file upload
  const handleFileUpload = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Text",
            extensions: ["txt", "md"],
          },
        ],
      });

      if (selected) {
        const content = await readTextFile(selected);
        setTranscript(content);
      }
    } catch (error) {
      console.error("Failed to read file:", error);
      setError(`Failed to read file: ${error}`);
    }
  };

  // Generate report using Claude API and save immediately
  const handleGenerateAndSave = async () => {
    if (!transcript.trim()) {
      setError("Please provide a consultation transcript");
      return;
    }

    if (!clientFolderPath) {
      setError("Client folder not created yet. Please create a folder before generating a report.");
      return;
    }

    setIsGenerating(true);
    setIsSaving(true);
    setError(null);

    try {
      // Generate report
      const result = await generateConsultationReport({
        clientName,
        petName,
        petSpecies,
        consultationDate: formattedDate,
        transcript,
      });

      // Detect next version number
      const version = await getNextVersionNumber();

      // Generate filename: {surname}_{YYYYMMDD}_consultation-report_v{version}.md
      const reportFileName = `${clientSurname.toLowerCase()}_${dateForFilename}_consultation-report_v${version}.md`;
      const reportFilePath = `${clientFolderPath}\\${reportFileName}`;

      // Save report as markdown file
      await invoke("write_text_file", {
        filePath: reportFilePath,
        content: result.report,
      });

      setSavedFilePath(reportFilePath);
      setSavedFileName(reportFileName);
      setSavedVersion(version);

      // Create "Report Generated" event
      await createEvent({
        clientId,
        eventType: "Note",
        date: new Date().toISOString(),
        notes: `<h2>Consultation Report Generated</h2><p><strong>File:</strong> ${reportFileName}</p><p><strong>Version:</strong> ${version}</p><p><strong>Consultation Date:</strong> ${formattedDate}</p><p>Report generated using AI and saved to client folder.</p>`,
      });

      // Auto-create review task (due 24 hours from now)
      const dueDate = dateToISO(addDays(new Date(), 1));
      await createTask({
        clientId,
        eventId,
        description: `Review and edit consultation report for ${clientName}`,
        dueDate,
        status: "Pending",
        priority: 2,
        automatedAction: "",
        triggeredBy: "AI Report Generation",
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "dashboard"] });
    } catch (err) {
      console.error("Failed to generate report:", err);
      setError(`Failed to generate report: ${err instanceof Error ? err.message : "Unknown error"}`);
      setSavedFilePath(null);
      setSavedFileName(null);
    } finally {
      setIsGenerating(false);
      setIsSaving(false);
    }
  };

  // Open MD file in default editor
  const handleOpenFile = async () => {
    if (!savedFilePath) return;

    try {
      await invoke("plugin:opener|open_path", { path: savedFilePath });
    } catch (err) {
      console.error("Failed to open file:", err);
      setError(`Failed to open file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Convert MD to DOCX with letterhead template
  const handleConvertToDocx = async () => {
    if (!savedFilePath || !clientFolderPath) return;

    setIsConvertingDocx(true);
    setError(null);

    try {
      // Check if template exists
      const templateExists = await checkTemplateExists("General_PBS_Letterhead.docx");

      if (!templateExists) {
        setError("Template not found. Please place 'General_PBS_Letterhead.docx' in Documents/PBS_Admin/Templates/");
        setIsConvertingDocx(false);
        return;
      }

      // Convert MD to DOCX
      const result = await convertReportToDocx({
        mdFilePath: savedFilePath,
        clientId,
        clientSurname,
        consultationDate: dateForFilename,
        version: savedVersion,
        clientFolderPath,
      });

      if (result.success) {
        setDocxFilePath(result.docxFilePath);
        setDocxFileName(result.docxFileName);

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["events", clientId] });
        queryClient.invalidateQueries({ queryKey: ["client", clientId] });

        alert(`DOCX created successfully!\n\nFile: ${result.docxFileName}`);
      } else {
        setError(`Failed to convert to DOCX: ${result.error}`);
      }
    } catch (err) {
      console.error("DOCX conversion error:", err);
      setError(`Failed to convert to DOCX: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsConvertingDocx(false);
    }
  };

  // Convert DOCX to PDF using MS Word
  const handleConvertToPdf = async () => {
    if (!docxFilePath || !clientFolderPath) return;

    setIsConvertingPdf(true);
    setError(null);

    try {
      // Convert DOCX to PDF
      const result = await convertReportToPdf({
        docxFilePath,
        clientId,
        clientFolderPath,
        petName,
        consultationDate: eventDate,
      });

      if (result.success) {
        setPdfFilePath(result.pdfFilePath);
        setPdfFileName(result.pdfFileName);

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["events", clientId] });
        queryClient.invalidateQueries({ queryKey: ["client", clientId] });

        alert(`PDF created successfully!\n\nFile: ${result.pdfFileName}\n\nReady to send to client.`);
      } else {
        setError(`Failed to convert to PDF: ${result.error}`);
      }
    } catch (err) {
      console.error("PDF conversion error:", err);
      setError(`Failed to convert to PDF: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsConvertingPdf(false);
    }
  };

  // Close and reset
  const handleClose = () => {
    setTranscript("");
    setSavedFilePath(null);
    setSavedFileName(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">Generate Consultation Report</DialogTitle>
          <DialogDescription className="text-[11px]">
            Use AI to generate a professional consultation report from the transcript
          </DialogDescription>
        </DialogHeader>

        {/* Consultation Info */}
        <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-muted/50 rounded-md text-[10px]">
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2">
          {!savedFilePath ? (
            // Step 1: Input transcript and generate
            <div className="space-y-2 flex-1 flex flex-col">
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
                <div className="flex items-start gap-2 px-2 py-1.5 bg-destructive/10 border border-destructive rounded-md">
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
                  onClick={handleClose}
                  size="sm"
                  disabled={isGenerating}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleGenerateAndSave}
                  size="sm"
                  disabled={!transcript.trim() || isGenerating || !clientFolderPath}
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
                      Generate & Save Report
                    </>
                  )}
                </Button>
              </div>

              {!clientFolderPath && (
                <p className="text-[10px] text-destructive">
                  Client folder not created yet. Please create a folder before generating the report.
                </p>
              )}
            </div>
          ) : (
            // Step 2: Success - show saved file info
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Report Generated Successfully</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    The markdown report has been saved to the client folder.
                  </p>
                </div>
              </div>

              <div className="space-y-2 px-3 py-2 bg-muted/50 rounded-md text-xs">
                <div>
                  <span className="text-muted-foreground">File:</span>{" "}
                  <span className="font-mono font-medium">{savedFileName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>{" "}
                  <span className="font-mono text-[10px]">{savedFilePath}</span>
                </div>
              </div>

              <div className="space-y-2 px-3 py-2 border rounded-md">
                <p className="text-xs font-medium">Next Steps:</p>
                <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                  <li>Open the markdown file in your editor (Notepad++, VS Code, etc.)</li>
                  <li>Review and edit the report content</li>
                  <li>Save your changes (filename stays the same)</li>
                  <li>Return to the consultation event to convert to DOCX/PDF</li>
                </ol>
              </div>

              <div className="space-y-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs font-medium text-blue-900">Task Created</p>
                <p className="text-[10px] text-blue-700">
                  A reminder task "Review and edit consultation report for {clientName}" has been created with a due date of 24 hours from now.
                </p>
              </div>

              {docxFileName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-green-900">DOCX Created</p>
                    <p className="text-[10px] text-green-700 font-mono">{docxFileName}</p>
                  </div>
                </div>
              )}

              {pdfFileName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-green-900">PDF Created - Ready to Send</p>
                    <p className="text-[10px] text-green-700 font-mono">{pdfFileName}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenFile}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                  Open MD File
                </Button>
                {!docxFileName && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleConvertToDocx}
                    size="sm"
                    disabled={isConvertingDocx}
                    className="h-8 text-xs"
                  >
                    {isConvertingDocx ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <FileType className="h-3.5 w-3.5 mr-1.5" />
                        Convert to DOCX
                      </>
                    )}
                  </Button>
                )}
                {docxFileName && !pdfFileName && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleConvertToPdf}
                    size="sm"
                    disabled={isConvertingPdf}
                    className="h-8 text-xs"
                  >
                    {isConvertingPdf ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Convert to PDF
                      </>
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleClose}
                  size="sm"
                  className="h-8 text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
