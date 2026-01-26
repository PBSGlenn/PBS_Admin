// PBS Admin - Report Sent Event Panel Component
// Handles report generation and delivery to clients and veterinarians

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileCheck,
  Loader2,
  FileText,
  Mail,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { invoke } from "@tauri-apps/api/core";
import type { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import { getEventsByClientId, updateEvent } from "@/lib/services/eventService";
import { getPetsByClientId } from "@/lib/services/petService";
import { getClientById } from "@/lib/services/clientService";
import { generateClientReport, generateVeterinaryReport } from "@/lib/services/multiReportGenerationService";
import { convertReportToDocxDirectly } from "@/lib/services/docxConversionService";
import { getEmailTemplate, processTemplate } from "@/lib/emailTemplates";
import { EmailDraftDialog, EmailAttachment } from "@/components/ui/email-draft-dialog";
import type { Event } from "@/lib/types";

type ReportType = "client" | "vet";

interface ConsultationSummary {
  eventId: number;
  date: string;
  formattedDate: string;
  petName: string;
  hasTranscript: boolean;
  hasClinicalNotes: boolean;
  transcriptPath: string | null;
  clinicalNotesPath: string | null;
}

interface ExistingReport {
  name: string;
  path: string;
  type: "client" | "vet";
  emailed?: boolean; // Tracked in event notes
  emailedDate?: string;
}

export function ReportSentEventPanel({
  clientId,
  event,
  clientFolderPath,
  clientName,
  onSave,
}: EventSpecificPanelProps) {
  const queryClient = useQueryClient();

  // State
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [reportType, setReportType] = useState<ReportType>("client");
  const [vetClinicName, setVetClinicName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // File state
  const [clinicalNotesPath, setClinicalNotesPath] = useState<string | null>(null);
  const [transcriptPath, setTranscriptPath] = useState<string | null>(null);
  const [existingReports, setExistingReports] = useState<ExistingReport[]>([]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocxPath, setGeneratedDocxPath] = useState<string | null>(null);
  const [generatedPdfPath, setGeneratedPdfPath] = useState<string | null>(null);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);

  // Email state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailingReportPath, setEmailingReportPath] = useState<string | null>(null); // Track which report is being emailed

  // Report log state - tracks all generated reports and their email status
  const [reportLog, setReportLog] = useState<Array<{
    fileName: string;
    reportType: "client" | "vet";
    generatedDate: string;
    emailed: boolean;
    emailedTo?: string;
    emailedDate?: string;
  }>>([]);

  // Parse existing notes to extract report log
  useEffect(() => {
    if (!event?.notes) return;

    // Parse report log from notes if present
    const logMatch = event.notes.match(/<!--REPORT_LOG:([\s\S]*?)-->/);
    if (logMatch) {
      try {
        const parsed = JSON.parse(logMatch[1]);
        setReportLog(parsed);
      } catch (e) {
        console.warn("Failed to parse report log from notes");
      }
    }
  }, [event?.notes]);

  // Helper to update event notes with report log
  const updateEventNotes = async (newReportLog?: typeof reportLog) => {
    if (!event?.eventId) return;

    const logToUse = newReportLog || reportLog;
    const consultation = consultations.find(c => c.eventId === selectedConsultationId);
    const pet = pets[0];

    let notesHtml = `<h2>Report Delivery Log</h2>`;

    if (consultation) {
      notesHtml += `<p><strong>Source Consultation:</strong> ${consultation.formattedDate}</p>`;
    }
    if (pet) {
      notesHtml += `<p><strong>Pet:</strong> ${pet.name}</p>`;
    }

    notesHtml += `<hr/><h3>Reports</h3>`;

    if (logToUse.length === 0) {
      notesHtml += `<p><em>No reports generated yet</em></p>`;
    } else {
      notesHtml += `<table style="width:100%; border-collapse: collapse; font-size: 11px;">`;
      notesHtml += `<tr style="background: #f5f5f5;"><th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">Report</th><th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">Generated</th><th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">Email Status</th></tr>`;

      for (const entry of logToUse) {
        const typeLabel = entry.reportType === "client" ? "Client" : "Vet";
        const emailStatus = entry.emailed
          ? `✓ Sent to ${entry.emailedTo} (${entry.emailedDate})`
          : "Not sent";
        const emailStyle = entry.emailed ? "color: green;" : "color: #888;";

        notesHtml += `<tr>`;
        notesHtml += `<td style="padding:4px; border-bottom:1px solid #eee;"><strong>${typeLabel}:</strong> ${entry.fileName}</td>`;
        notesHtml += `<td style="padding:4px; border-bottom:1px solid #eee;">${entry.generatedDate}</td>`;
        notesHtml += `<td style="padding:4px; border-bottom:1px solid #eee; ${emailStyle}">${emailStatus}</td>`;
        notesHtml += `</tr>`;
      }

      notesHtml += `</table>`;
    }

    // Store machine-readable log in HTML comment
    notesHtml += `\n<!--REPORT_LOG:${JSON.stringify(logToUse)}-->`;

    try {
      await updateEvent(event.eventId, {
        notes: notesHtml,
        parentEventId: selectedConsultationId || undefined
      });

      queryClient.invalidateQueries({ queryKey: ["events", clientId] });

      if (onSave) {
        const updated = { ...event, notes: notesHtml, parentEventId: selectedConsultationId };
        onSave(updated as Event);
      }
    } catch (error) {
      console.error("Failed to update event notes:", error);
    }
  };

  // Add report to log
  const addReportToLog = async (fileName: string, type: "client" | "vet") => {
    const timestamp = format(new Date(), "d MMM yyyy HH:mm");
    const newEntry = {
      fileName,
      reportType: type,
      generatedDate: timestamp,
      emailed: false
    };
    const newLog = [...reportLog, newEntry];
    setReportLog(newLog);
    await updateEventNotes(newLog);
  };

  // Mark report as emailed in log (adds to log if not already present)
  const markReportAsEmailed = async (fileName: string, emailedTo: string, fileType?: "client" | "vet") => {
    const timestamp = format(new Date(), "d MMM yyyy HH:mm");

    // Check if report exists in log
    const existingEntry = reportLog.find(entry => entry.fileName === fileName);

    let newLog: typeof reportLog;
    if (existingEntry) {
      // Update existing entry
      newLog = reportLog.map(entry =>
        entry.fileName === fileName
          ? { ...entry, emailed: true, emailedTo, emailedDate: timestamp }
          : entry
      );
    } else {
      // Add new entry for pre-existing report being emailed
      const newEntry = {
        fileName,
        reportType: fileType || reportType,
        generatedDate: "Pre-existing",
        emailed: true,
        emailedTo,
        emailedDate: timestamp
      };
      newLog = [...reportLog, newEntry];
    }

    setReportLog(newLog);
    await updateEventNotes(newLog);
  };


  // Fetch consultations for this client
  const { data: consultations = [] } = useQuery({
    queryKey: ["consultations", clientId],
    queryFn: async () => {
      const events = await getEventsByClientId(clientId);
      const consultationEvents = events.filter(e => e.eventType === "Consultation");

      // Get pet info
      const pets = await getPetsByClientId(clientId);
      const petNames = pets.map(p => p.name).join(", ") || "Unknown Pet";

      // Build summaries
      const summaries: ConsultationSummary[] = [];
      for (const consult of consultationEvents) {
        summaries.push({
          eventId: consult.eventId,
          date: consult.date,
          formattedDate: format(parseISO(consult.date), "d MMM yyyy"),
          petName: petNames,
          hasTranscript: !!consult.transcriptFilePath,
          hasClinicalNotes: false, // Will be detected from folder
          transcriptPath: consult.transcriptFilePath || null,
          clinicalNotesPath: null
        });
      }

      return summaries;
    }
  });

  // Fetch client for primaryCareVet
  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientById(clientId)
  });

  // Fetch pets
  const { data: pets = [] } = useQuery({
    queryKey: ["pets", clientId],
    queryFn: () => getPetsByClientId(clientId)
  });

  // Pre-fill vet clinic from client
  useEffect(() => {
    if (client?.primaryCareVet && !vetClinicName) {
      setVetClinicName(client.primaryCareVet);
    }
  }, [client?.primaryCareVet]);

  // Pre-fill client email
  useEffect(() => {
    if (client?.email && reportType === "client" && !recipientEmail) {
      setRecipientEmail(client.email);
    }
  }, [client?.email, reportType]);

  // Detect files when consultation is selected
  useEffect(() => {
    if (!selectedConsultationId || !clientFolderPath) return;

    const detectFiles = async () => {
      const consultation = consultations.find(c => c.eventId === selectedConsultationId);
      if (!consultation) return;

      try {
        const dateStr = format(parseISO(consultation.date), "yyyyMMdd");
        const entries = await invoke<Array<{ name: string; isDirectory: boolean }>>(
          "plugin:fs|read_dir",
          { path: clientFolderPath }
        );

        // Find clinical notes
        const clinicalNotesFile = entries.find(f =>
          !f.isDirectory &&
          f.name.includes(dateStr) &&
          (f.name.includes("comprehensive-clinical") || f.name.includes("practitioner-report")) &&
          f.name.endsWith(".docx")
        );

        if (clinicalNotesFile) {
          setClinicalNotesPath(`${clientFolderPath}\\${clinicalNotesFile.name}`);
        } else {
          setClinicalNotesPath(null);
        }

        // Set transcript path from event
        setTranscriptPath(consultation.transcriptPath);

        // Find existing reports for this consultation
        const reports: ExistingReport[] = [];
        for (const entry of entries) {
          if (entry.isDirectory) continue;
          if (!entry.name.includes(dateStr)) continue;

          if (entry.name.includes("client-report")) {
            reports.push({
              name: entry.name,
              path: `${clientFolderPath}\\${entry.name}`,
              type: "client"
            });
          } else if (entry.name.includes("vet-report")) {
            reports.push({
              name: entry.name,
              path: `${clientFolderPath}\\${entry.name}`,
              type: "vet"
            });
          }
        }
        setExistingReports(reports);

      } catch (error) {
        console.error("Failed to detect files:", error);
      }
    };

    detectFiles();
  }, [selectedConsultationId, clientFolderPath, consultations]);

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConsultationId || !clientFolderPath) {
        throw new Error("Please select a consultation first");
      }

      const consultation = consultations.find(c => c.eventId === selectedConsultationId);
      if (!consultation) {
        throw new Error("Consultation not found");
      }

      setIsGenerating(true);

      // Read clinical notes if available
      let clinicalNotesContent = "";
      if (clinicalNotesPath) {
        try {
          // For DOCX, we'll use a simple extraction or pass the path
          // For now, read the transcript as primary source
          // TODO: Implement proper DOCX text extraction
          clinicalNotesContent = `[Clinical notes available at: ${clinicalNotesPath}]`;
        } catch (error) {
          console.warn("Could not read clinical notes:", error);
        }
      }

      // Read transcript
      let transcriptContent = "";
      if (transcriptPath) {
        try {
          transcriptContent = await invoke<string>("read_text_file", {
            filePath: transcriptPath
          });
        } catch (error) {
          console.warn("Could not read transcript:", error);
        }
      }

      if (!transcriptContent && !clinicalNotesContent) {
        throw new Error("No source documents found. Please ensure transcript or clinical notes are available.");
      }

      // Prepare params
      const pet = pets[0];
      const reportParams = {
        clientName: clientName || "Unknown Client",
        petName: pet?.name || "Unknown Pet",
        petSpecies: pet?.species || "Dog",
        petBreed: pet?.breed || undefined,
        consultationDate: consultation.formattedDate,
        // Use transcript as main content source
        // In future, we'd extract text from clinical notes DOCX and use that as primary
        transcript: transcriptContent || clinicalNotesContent,
        questionnaire: undefined,
        vetClinicName: reportType === "vet" ? vetClinicName : undefined
      };

      // Generate report
      let result;
      if (reportType === "client") {
        result = await generateClientReport(reportParams);
      } else {
        if (!vetClinicName.trim()) {
          throw new Error("Please enter the vet clinic name");
        }
        result = await generateVeterinaryReport(reportParams);
      }

      // Get client surname for file naming
      const clientSurname = clientName?.split(" ").pop()?.toLowerCase() || "client";
      const dateStr = format(parseISO(consultation.date), "yyyyMMdd");

      // Convert to DOCX
      const docxResult = await convertReportToDocxDirectly({
        markdownContent: result.content,
        clientId,
        clientSurname,
        consultationDate: dateStr,
        reportType: reportType === "client" ? "clientReport" : "vetReport",
        version: 1,
        clientFolderPath
      });

      setGeneratedDocxPath(docxResult.docxFilePath);
      // Clear any previous PDF - user needs to convert after reviewing DOCX
      setGeneratedPdfPath(null);

      return docxResult;
    },
    onSuccess: async (docxResult) => {
      toast.success(`${reportType === "client" ? "Client" : "Vet"} report generated successfully`);
      setIsGenerating(false);

      // Add report to log
      const fileName = docxResult.docxFilePath.split("\\").pop() || "report.docx";
      await addReportToLog(fileName, reportType);
    },
    onError: (error) => {
      toast.error("Failed to generate report", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
      setIsGenerating(false);
    }
  });

  // Open generated document
  const handleOpenDocument = async (path: string) => {
    try {
      await invoke("plugin:opener|open_path", { path });
    } catch (error) {
      toast.error("Failed to open document");
    }
  };

  // Convert DOCX to PDF (after user has reviewed/edited)
  const handleConvertToPdf = async () => {
    if (!generatedDocxPath) {
      toast.error("No DOCX file to convert");
      return;
    }

    setIsConvertingPdf(true);

    try {
      const pdfPath = generatedDocxPath.replace(".docx", ".pdf");
      await invoke("convert_docx_to_pdf", {
        docxPath: generatedDocxPath,
        pdfPath
      });
      setGeneratedPdfPath(pdfPath);
      toast.success("PDF created successfully");

      // Add PDF to log (replaces DOCX entry or adds new)
      const fileName = pdfPath.split("\\").pop() || "report.pdf";
      await addReportToLog(fileName, reportType);
    } catch (error) {
      toast.error("Failed to convert to PDF", {
        description: error instanceof Error ? error.message : "Make sure MS Word is installed"
      });
    } finally {
      setIsConvertingPdf(false);
    }
  };

  // Get email content
  const getEmailContent = () => {
    const templateId = reportType === "client" ? "consultation-report" : "vet-report-cover";
    const template = getEmailTemplate(templateId);
    const consultation = consultations.find(c => c.eventId === selectedConsultationId);
    const pet = pets[0];

    const fallbackSubject = reportType === "client"
      ? `${pet?.name || "Pet"} - Consultation Report`
      : `Behaviour Consultation Report - ${pet?.name || "Pet"} ${clientName?.split(" ").pop() || ""}`;

    const fallbackBody = reportType === "client"
      ? `Dear ${clientName?.split(" ")[0] || "Client"},\n\nPlease find attached the consultation report for ${pet?.name || "your pet"}.\n\nBest regards,\nPet Behaviour Services`
      : `Dear Colleague,\n\nPlease find attached my behaviour consultation report for ${pet?.name || "Pet"} ${clientName?.split(" ").pop() || ""}, seen on ${consultation?.formattedDate || "the consultation date"}.\n\nKind regards,\nDr. Glenn Tobiansky`;

    if (!template) {
      return { subject: fallbackSubject, body: fallbackBody };
    }

    const variables = {
      clientFirstName: clientName?.split(" ")[0] || "",
      clientLastName: clientName?.split(" ").slice(1).join(" ") || "",
      petName: pet?.name || "",
      consultationDate: consultation?.formattedDate || "",
      vetClinicName: vetClinicName
    };

    return {
      subject: processTemplate(template.subject, variables),
      body: processTemplate(template.body, variables)
    };
  };

  // Handle opening email app with mailto: link
  const handleOpenEmailApp = async (to: string, subject: string, body: string) => {
    // Open mailto: link in default email app
    const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      await invoke("plugin:opener|open_url", { url: mailtoLink });
      toast.info("Email app opened - don't forget to attach the report!", {
        description: "Manually attach the report file and click Send in your email app",
        duration: 5000
      });
    } catch (error) {
      console.error("Failed to open email app:", error);
      toast.error("Failed to open email app");
    }
  };

  // Handle marking as sent (updates event tracking)
  const handleMarkAsSent = async () => {
    // Get the report file name and type being emailed
    let reportFileName: string | undefined;
    let fileType: "client" | "vet" | undefined;

    if (emailingReportPath) {
      reportFileName = emailingReportPath.split("\\").pop();
      // Determine type from filename
      if (reportFileName?.includes("client-report")) {
        fileType = "client";
      } else if (reportFileName?.includes("vet-report")) {
        fileType = "vet";
      }
    } else if (generatedPdfPath) {
      reportFileName = generatedPdfPath.split("\\").pop();
      fileType = reportType;
    } else if (generatedDocxPath) {
      reportFileName = generatedDocxPath.split("\\").pop();
      fileType = reportType;
    } else if (existingReportsForType[0]) {
      reportFileName = existingReportsForType[0].name;
      fileType = existingReportsForType[0].type;
    }

    if (reportFileName) {
      await markReportAsEmailed(reportFileName, recipientEmail, fileType);
    }

    setEmailSent(true);
    setShowEmailDialog(false);
    setEmailingReportPath(null);
    toast.success("Report marked as sent");
  };

  // Selected consultation
  const selectedConsultation = consultations.find(c => c.eventId === selectedConsultationId);

  // Filter existing reports by type
  const existingReportsForType = existingReports.filter(r => r.type === reportType);

  return (
    <div className="space-y-4">
      {/* Client Name Display */}
      <div className="pb-2 border-b">
        <p className="text-[10px] text-muted-foreground">Client</p>
        <p className="font-semibold text-xs">{clientName || "Unknown Client"}</p>
      </div>

      {/* Folder Warning */}
      {!clientFolderPath && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
          <p className="text-[10px] text-amber-600">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            Client folder not created - please create folder first
          </p>
        </div>
      )}

      {/* Section 1: Source Consultation Selection */}
      <Card className="p-3">
        <h4 className="text-xs font-semibold mb-2">SOURCE CONSULTATION</h4>

        {consultations.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            No consultations found for this client
          </p>
        ) : (
          <div className="space-y-2">
            <Select
              value={selectedConsultationId?.toString() || ""}
              onValueChange={(value) => setSelectedConsultationId(Number(value))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select consultation..." />
              </SelectTrigger>
              <SelectContent>
                {consultations.map((c) => (
                  <SelectItem key={c.eventId} value={c.eventId.toString()}>
                    {c.formattedDate} - {c.petName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source Status */}
            {selectedConsultation && (
              <div className="flex gap-3 text-[10px]">
                <span className={clinicalNotesPath ? "text-green-600" : "text-muted-foreground"}>
                  {clinicalNotesPath ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertCircle className="h-3 w-3 inline mr-1" />}
                  Clinical Notes
                </span>
                <span className={transcriptPath ? "text-green-600" : "text-muted-foreground"}>
                  {transcriptPath ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertCircle className="h-3 w-3 inline mr-1" />}
                  Transcript
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section 2: Report Type Selection */}
      {selectedConsultationId && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">REPORT TYPE</h4>

          <RadioGroup
            value={reportType}
            onValueChange={(value) => setReportType(value as ReportType)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="client" id="client" className="h-3.5 w-3.5" />
              <Label htmlFor="client" className="text-[11px] cursor-pointer">
                Client Report
              </Label>
            </div>
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="vet" id="vet" className="h-3.5 w-3.5 mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="vet" className="text-[11px] cursor-pointer">
                  Vet Report
                </Label>
                {reportType === "vet" && (
                  <div className="mt-1.5">
                    <Label className="text-[9px] text-muted-foreground">Vet Clinic Name</Label>
                    <Input
                      value={vetClinicName}
                      onChange={(e) => setVetClinicName(e.target.value)}
                      placeholder="Enter vet clinic name..."
                      className="h-7 text-[10px] mt-0.5"
                    />
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </Card>
      )}

      {/* Section 3: Generate / Existing Reports */}
      {selectedConsultationId && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">GENERATE REPORT</h4>

          {/* Existing Reports */}
          {existingReportsForType.length > 0 && (
            <div className="mb-3 p-2 bg-blue-50 rounded-md border border-blue-100">
              <p className="text-[10px] font-medium text-blue-800 mb-1">
                Existing {reportType === "client" ? "Client" : "Vet"} Reports:
              </p>
              <div className="space-y-1.5">
                {existingReportsForType.map((report, idx) => {
                  const logEntry = reportLog.find(entry => entry.fileName === report.name);
                  const isEmailed = logEntry?.emailed || false;

                  return (
                    <div key={idx} className="flex items-center justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-blue-700 block truncate">{report.name}</span>
                        {isEmailed && logEntry && (
                          <span className="text-[9px] text-green-600">
                            ✓ Sent to {logEntry.emailedTo} ({logEntry.emailedDate})
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDocument(report.path)}
                          className="h-5 px-1.5 text-[9px]"
                          title="Open document"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEmailingReportPath(report.path);
                            setShowEmailDialog(true);
                          }}
                          className={`h-5 px-1.5 text-[9px] ${isEmailed ? 'text-green-600' : 'text-blue-600'}`}
                          title={isEmailed ? "Send again" : "Send via email"}
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={() => generateReportMutation.mutate()}
            disabled={isGenerating || !selectedConsultationId || (reportType === "vet" && !vetClinicName.trim())}
            className="w-full h-8 text-xs"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-3 w-3 mr-1.5" />
                {existingReportsForType.length > 0 ? "Generate New Version" : "Generate Report"}
              </>
            )}
          </Button>

          {/* Generated Report Success */}
          {generatedDocxPath && !isGenerating && (
            <div className="mt-3 p-2 bg-green-50 rounded-md border border-green-200">
              <div className="flex items-start gap-2">
                <FileCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-green-800 font-medium">
                    Report generated successfully
                  </p>
                  <p className="text-[10px] text-green-700 mt-0.5 truncate">
                    {generatedDocxPath.split("\\").pop()}
                  </p>
                </div>
              </div>
              {/* Step 1: Open and review DOCX */}
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDocument(generatedDocxPath)}
                  className="h-7 text-[10px] w-full"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open DOCX to Review/Edit
                </Button>
                <p className="text-[9px] text-muted-foreground mt-1 text-center">
                  Review and make any changes in Word, then save
                </p>
              </div>

              {/* Step 2: Convert to PDF after review */}
              {!generatedPdfPath ? (
                <div className="mt-3 pt-3 border-t">
                  <Button
                    onClick={handleConvertToPdf}
                    disabled={isConvertingPdf}
                    className="h-7 text-[10px] w-full bg-orange-600 hover:bg-orange-700"
                  >
                    {isConvertingPdf ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3 mr-1" />
                        Convert to PDF (after review)
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-[10px] text-green-700 font-medium">
                      PDF ready: {generatedPdfPath.split("\\").pop()}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDocument(generatedPdfPath)}
                    className="h-6 text-[10px] w-full"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open PDF
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Section 4: Send Report - Only show after PDF is ready */}
      {generatedPdfPath && selectedConsultationId && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">SEND REPORT</h4>

          {emailSent ? (
            <div className="p-2 bg-green-50 rounded-md border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-[11px] text-green-800 font-medium">
                    Report delivery tracked
                  </p>
                  <p className="text-[10px] text-green-600">
                    Remember to send the email with attachment from your email app
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <Label className="text-[9px] text-muted-foreground">Recipient Email</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={reportType === "client" ? "Client email..." : "Vet clinic email..."}
                  className="h-7 text-[10px]"
                />
              </div>

              <Button
                onClick={() => setShowEmailDialog(true)}
                disabled={!recipientEmail}
                className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
              >
                <Mail className="h-3 w-3 mr-1.5" />
                Preview & Send Email
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Email Draft Dialog */}
      <EmailDraftDialog
        isOpen={showEmailDialog}
        onClose={() => {
          setShowEmailDialog(false);
          setEmailingReportPath(null);
        }}
        onSend={handleOpenEmailApp}
        onMarkAsSent={handleMarkAsSent}
        onEmailSent={async (to, subject) => {
          // Mark report as emailed when sent via Resend
          let reportFileName: string | undefined;
          let fileType: "client" | "vet" | undefined;

          const reportPath = emailingReportPath || generatedPdfPath || generatedDocxPath || existingReportsForType[0]?.path;
          if (reportPath) {
            reportFileName = reportPath.split("\\").pop();
            if (reportFileName?.includes("client-report")) {
              fileType = "client";
            } else if (reportFileName?.includes("vet-report")) {
              fileType = "vet";
            } else {
              fileType = reportType;
            }
          }

          if (reportFileName) {
            await markReportAsEmailed(reportFileName, to, fileType);
          }

          setEmailSent(true);
          setEmailingReportPath(null);
        }}
        initialTo={recipientEmail}
        initialSubject={getEmailContent().subject}
        initialBody={getEmailContent().body}
        clientName={clientName || ""}
        attachments={(() => {
          // Determine which file to attach
          const reportPath = emailingReportPath || generatedPdfPath || generatedDocxPath || existingReportsForType[0]?.path;
          if (reportPath) {
            const fileName = reportPath.split("\\").pop() || "report";
            return [{ path: reportPath, name: fileName }];
          }
          return [];
        })()}
        attachmentReminder={`${(emailingReportPath || generatedPdfPath || generatedDocxPath || existingReportsForType[0]?.path)?.split("\\").pop() || "Report"}\n\nLocation: ${clientFolderPath}`}
      />
    </div>
  );
}
