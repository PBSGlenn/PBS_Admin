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
  ListTodo,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { invoke } from "@tauri-apps/api/core";
import { calculateAge } from "@/lib/utils/ageUtils";
import { buildSignalmentBlock } from "@/lib/utils/petSignalmentUtils";
import type { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import { getEventsByClientId, updateEvent } from "@/lib/services/eventService";
import { getPetsByClientId } from "@/lib/services/petService";
import { getClientById } from "@/lib/services/clientService";
import { generateClientReport, generateVeterinaryReport } from "@/lib/services/multiReportGenerationService";
import { convertReportToDocxDirectly } from "@/lib/services/docxConversionService";
import { markConsultationComplete } from "@/lib/services/bookingSyncService";
import { getEmailTemplate, processTemplate } from "@/lib/emailTemplates";
import { EmailDraftDialog, EmailAttachment } from "@/components/ui/email-draft-dialog";
import type { Event } from "@/lib/types";
import { getVetClinics, type VetClinic } from "@/lib/services/vetClinicsService";
import { getTasksByEventId, createTask } from "@/lib/services/taskService";
import { getAnthropicApiKey, getAIModelConfig } from "@/lib/services/apiKeysService";
import { calculateDueDate } from "@/lib/utils/dateOffsetUtils";
import type { Task, TaskInput } from "@/lib/types";

type ReportType = "client" | "vet";

interface ExtractedTask {
  id: string;
  description: string;
  offset: string;
  priority: 1 | 2 | 3 | 4 | 5;
  context: string;
  isDuplicate?: boolean; // Flagged if similar to existing task
  duplicateOf?: string; // Description of the existing task it duplicates
}

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
  const [selectedVetClinicId, setSelectedVetClinicId] = useState<string | null>(null);
  const [vetClinics, setVetClinics] = useState<VetClinic[]>([]);

  // File state
  const [clinicalNotesPath, setClinicalNotesPath] = useState<string | null>(null);
  const [transcriptPath, setTranscriptPath] = useState<string | null>(null);
  const [existingReports, setExistingReports] = useState<ExistingReport[]>([]);
  const [fileRefreshKey, setFileRefreshKey] = useState(0); // Used to force file re-detection

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocxPath, setGeneratedDocxPath] = useState<string | null>(null);
  const [generatedPdfPath, setGeneratedPdfPath] = useState<string | null>(null);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);

  // Email state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailingReportPath, setEmailingReportPath] = useState<string | null>(null); // Track which report is being emailed
  const [emailContent, setEmailContent] = useState({ subject: "", body: "" });

  // Task extraction state
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [existingTasks, setExistingTasks] = useState<Task[]>([]);
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [tasksCreated, setTasksCreated] = useState(false);

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

  // Load vet clinics from directory
  useEffect(() => {
    getVetClinics().then(setVetClinics);
  }, []);

  // Pre-fill vet clinic from client's primary care vet
  useEffect(() => {
    if (client?.primaryCareVet && !vetClinicName) {
      setVetClinicName(client.primaryCareVet);
      // Try to find matching clinic in directory
      const matchingClinic = vetClinics.find(vc =>
        vc.name.toLowerCase().includes(client.primaryCareVet!.toLowerCase()) ||
        client.primaryCareVet!.toLowerCase().includes(vc.name.toLowerCase())
      );
      if (matchingClinic) {
        setSelectedVetClinicId(matchingClinic.id);
        setRecipientEmail(matchingClinic.email);
      }
    }
  }, [client?.primaryCareVet, vetClinics]);

  // Update email when report type changes
  useEffect(() => {
    if (reportType === "client") {
      // Switch to client email
      if (client?.email) {
        setRecipientEmail(client.email);
      }
    } else if (reportType === "vet") {
      // Switch to vet clinic email (if one is selected)
      const selectedClinic = vetClinics.find(vc => vc.id === selectedVetClinicId);
      if (selectedClinic) {
        setRecipientEmail(selectedClinic.email);
      } else {
        // Clear email if no vet clinic selected - user needs to enter manually
        setRecipientEmail("");
      }
    }
  }, [reportType, client?.email, selectedVetClinicId, vetClinics]);

  // Handle vet clinic selection
  const handleVetClinicSelect = (clinicId: string) => {
    setSelectedVetClinicId(clinicId);
    const clinic = vetClinics.find(vc => vc.id === clinicId);
    if (clinic) {
      setVetClinicName(clinic.name);
      setRecipientEmail(clinic.email);
    }
  };

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

        // Find clinical notes - prefer .md source (readable) over .docx
        const clinicalNotesMd = entries.find(f =>
          !f.isDirectory &&
          f.name.includes(dateStr) &&
          (f.name.includes("comprehensive-clinical") || f.name.includes("practitioner-report")) &&
          f.name.endsWith(".md")
        );
        const clinicalNotesDocx = entries.find(f =>
          !f.isDirectory &&
          f.name.includes(dateStr) &&
          (f.name.includes("comprehensive-clinical") || f.name.includes("practitioner-report")) &&
          f.name.endsWith(".docx")
        );

        if (clinicalNotesMd) {
          setClinicalNotesPath(`${clientFolderPath}\\${clinicalNotesMd.name}`);
        } else if (clinicalNotesDocx) {
          setClinicalNotesPath(`${clientFolderPath}\\${clinicalNotesDocx.name}`);
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
  }, [selectedConsultationId, clientFolderPath, consultations, fileRefreshKey]);

  // Load existing tasks for the selected consultation
  useEffect(() => {
    if (!selectedConsultationId) {
      setExistingTasks([]);
      return;
    }
    getTasksByEventId(selectedConsultationId).then(tasks => {
      setExistingTasks(tasks.filter(t => t.status !== "Canceled"));
    }).catch(() => setExistingTasks([]));
  }, [selectedConsultationId, tasksCreated]);

  // Check if an extracted task is similar to an existing task
  const findDuplicate = (description: string, existing: Task[]): Task | undefined => {
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const desc = normalise(description);
    return existing.find(t => {
      const existingDesc = normalise(t.description);
      // Check for significant overlap
      const words = desc.split(" ").filter(w => w.length > 3);
      const matchCount = words.filter(w => existingDesc.includes(w)).length;
      return matchCount >= Math.ceil(words.length * 0.5);
    });
  };

  // Extract tasks from reports
  const handleExtractTasksFromReports = async () => {
    if (!selectedConsultationId || !clientFolderPath) return;

    const consultation = consultations.find(c => c.eventId === selectedConsultationId);
    if (!consultation) return;

    setIsExtractingTasks(true);
    setExtractedTasks([]);

    try {
      // Read comprehensive clinical report and client report.
      // Filename variants: comprehensive uses "comprehensive-clinical" OR "practitioner-report".
      // Client uses "client-report". Both may be .md (native) or .docx (edited final).
      // Versioned (_vN) and unversioned (finalised) variants both valid.
      // Selection preference: unversioned finalised > highest version; .md > .docx.
      let comprehensiveContent = "";
      let clientReportContent = "";
      const dateStr = format(parseISO(consultation.date), "yyyyMMdd");
      const entries = await invoke<Array<{ name: string; isDirectory: boolean }>>(
        "plugin:fs|read_dir",
        { path: clientFolderPath }
      );

      const pickBest = (matches: Array<{ name: string }>) => {
        if (matches.length === 0) return null;
        const ranked = matches.map(f => {
          const versionMatch = f.name.match(/_v(\d+)\.(md|docx)$/i);
          const version = versionMatch ? parseInt(versionMatch[1], 10) : -1; // -1 = unversioned (finalised) → wins
          const isMd = f.name.toLowerCase().endsWith(".md");
          return { name: f.name, version, isMd };
        });
        ranked.sort((a, b) => {
          if (a.version !== b.version) return a.version - b.version; // unversioned (-1) first, then lowest version
          if (a.isMd !== b.isMd) return a.isMd ? -1 : 1; // .md wins
          return 0;
        });
        // Unversioned (finalised) wins; otherwise pick highest version
        const unversioned = ranked.find(r => r.version === -1);
        if (unversioned) return unversioned;
        return ranked[ranked.length - 1];
      };

      const readReportFile = async (fileName: string): Promise<string> => {
        const fullPath = `${clientFolderPath}\\${fileName}`;
        if (fileName.toLowerCase().endsWith(".md")) {
          return await invoke<string>("read_text_file", { filePath: fullPath });
        }
        return await invoke<string>("pandoc_docx_to_markdown", { docxPath: fullPath });
      };

      const comprehensiveCandidates = entries.filter(f =>
        !f.isDirectory &&
        f.name.includes(dateStr) &&
        (f.name.includes("comprehensive-clinical") || f.name.includes("practitioner-report")) &&
        (f.name.toLowerCase().endsWith(".md") || f.name.toLowerCase().endsWith(".docx"))
      );
      const comprehensivePick = pickBest(comprehensiveCandidates);
      if (comprehensivePick) {
        try {
          comprehensiveContent = await readReportFile(comprehensivePick.name);
        } catch (err) {
          console.warn(`Failed to read comprehensive report ${comprehensivePick.name}:`, err);
        }
      }

      const clientReportCandidates = entries.filter(f =>
        !f.isDirectory &&
        f.name.includes(dateStr) &&
        f.name.includes("client-report") &&
        (f.name.toLowerCase().endsWith(".md") || f.name.toLowerCase().endsWith(".docx"))
      );
      const clientReportPick = pickBest(clientReportCandidates);
      if (clientReportPick) {
        try {
          clientReportContent = await readReportFile(clientReportPick.name);
        } catch (err) {
          console.warn(`Failed to read client report ${clientReportPick.name}:`, err);
        }
      }

      if (!comprehensiveContent && !clientReportContent) {
        toast.error("No report files found", {
          description: "Generate comprehensive and client reports first"
        });
        return;
      }

      // Read transcript if available
      let transcriptContent = "";
      if (consultation.transcriptPath) {
        try {
          transcriptContent = await invoke<string>("read_text_file", {
            filePath: consultation.transcriptPath
          });
        } catch { /* transcript is optional here */ }
      }

      const apiKey = await getAnthropicApiKey();
      if (!apiKey) {
        toast.error("Anthropic API key not configured");
        return;
      }

      const modelConfig = await getAIModelConfig();

      // Build existing tasks context for duplicate awareness
      const existingTasksContext = existingTasks.length > 0
        ? `\n\nEXISTING TASKS (already created for this consultation - do NOT duplicate these):\n${existingTasks.map(t => `- ${t.description} (${t.status}, due: ${t.dueDate})`).join("\n")}`
        : "";

      // Build source documents
      let sourceDocuments = "";
      if (comprehensiveContent) {
        sourceDocuments += `COMPREHENSIVE CLINICAL REPORT:\n${comprehensiveContent.substring(0, 10000)}\n\n`;
      }
      if (clientReportContent) {
        sourceDocuments += `CLIENT REPORT:\n${clientReportContent.substring(0, 8000)}\n\n`;
      }
      if (transcriptContent) {
        sourceDocuments += `TRANSCRIPT (supplementary):\n${transcriptContent.substring(0, 10000)}\n\n`;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: modelConfig.taskExtractionModel,
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: `You are a veterinary behaviour consultant's assistant. Extract ONLY practitioner tasks (things the vet needs to do) from the consultation reports below. Do NOT include client homework or pet training exercises.

Cross-reference the comprehensive clinical report AND client report to ensure:
- All commitments made to the client are captured as tasks (e.g., "I'll send a follow-up email", "We'll schedule a training session")
- All clinical recommendations requiring practitioner action are captured
- Tasks are consistent between both reports — no contradictions

Common practitioner tasks include:
- Send consultation report to client
- Send vet report/letter to referring vet
- Schedule follow-up consultation
- Send specific resources, protocols, or training plans
- Contact referring vet about medication
- Review case in X weeks
- Send follow-up email to check progress
${existingTasksContext}

Return a JSON array of NEW tasks only (exclude any that duplicate existing tasks listed above). Each task should have:
- description: Clear, actionable task description
- offset: When due relative to consultation date (e.g., "3 days", "1 week", "2 weeks")
- priority: 1-5 (1 = highest priority)
- context: Which report this task came from and why it's needed

If no additional tasks are found, return an empty array: []

${sourceDocuments}

Return ONLY valid JSON array, no other text.`
          }]
        })
      });

      if (!response.ok) throw new Error(`API request failed: ${response.status}`);

      const data = await response.json();
      let content = data.content[0]?.text || "[]";

      content = content.trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const tasks: ExtractedTask[] = parsed.map((task: any, index: number) => {
          const rawPriority = Number(task.priority) || 2;
          const priority = Math.max(1, Math.min(5, rawPriority)) as 1 | 2 | 3 | 4 | 5;
          const duplicate = findDuplicate(task.description || "", existingTasks);
          return {
            id: `report-task-${Date.now()}-${index}`,
            description: task.description || "",
            offset: task.offset || "1 week",
            priority,
            context: task.context || "",
            isDuplicate: !!duplicate,
            duplicateOf: duplicate?.description,
          };
        });
        setExtractedTasks(tasks);
        const newCount = tasks.filter(t => !t.isDuplicate).length;
        const dupCount = tasks.filter(t => t.isDuplicate).length;
        let msg = `Extracted ${newCount} new task${newCount !== 1 ? "s" : ""}`;
        if (dupCount > 0) msg += ` (${dupCount} potential duplicate${dupCount !== 1 ? "s" : ""} flagged)`;
        toast.success(msg);
      }
    } catch (error) {
      console.error("Task extraction failed:", error);
      toast.error("Failed to extract tasks", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsExtractingTasks(false);
    }
  };

  // Create selected extracted tasks
  const handleCreateExtractedTasks = async () => {
    const tasksToCreate = extractedTasks.filter(t => !t.isDuplicate);
    if (tasksToCreate.length === 0) {
      toast.info("No new tasks to create");
      return;
    }

    const consultation = consultations.find(c => c.eventId === selectedConsultationId);
    if (!consultation) return;

    setIsCreatingTasks(true);
    try {
      for (const task of tasksToCreate) {
        const dueDate = calculateDueDate(consultation.date, task.offset);
        const taskInput: TaskInput = {
          clientId,
          eventId: selectedConsultationId!,
          description: task.description,
          dueDate,
          status: "Pending",
          priority: task.priority,
          automatedAction: "ReportTaskExtraction",
          triggeredBy: "ReportSent",
        };
        await createTask(taskInput);
      }

      toast.success(`Created ${tasksToCreate.length} task${tasksToCreate.length !== 1 ? "s" : ""}`);
      setTasksCreated(true);
      setExtractedTasks([]);

      // Invalidate task queries
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "dashboard"] });
    } catch (error) {
      toast.error("Failed to create tasks", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsCreatingTasks(false);
    }
  };

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

      // Read clinical notes if available (.md files can be read directly)
      let clinicalNotesContent = "";
      if (clinicalNotesPath && clinicalNotesPath.endsWith(".md")) {
        try {
          clinicalNotesContent = await invoke<string>("read_text_file", {
            filePath: clinicalNotesPath
          });
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
        throw new Error("No source documents found. Please ensure transcript and/or clinical notes (.md) are available in the client folder.");
      }

      // Prepare params with client details for variable injection
      const pet = pets[0];
      const clientAddressParts = [
        client?.streetAddress,
        [client?.city, client?.state, client?.postcode].filter(Boolean).join(' ')
      ].filter(Boolean);
      const clientAddress = clientAddressParts.join('\n');

      // Authoritative signalment built from the Pet DB record(s).
      // The client report MUST use this verbatim rather than extracting
      // breed/sex/age/weight from the transcript or comprehensive clinical
      // report, which may carry cautious in-room wording.
      const signalment = pets.length > 0 ? buildSignalmentBlock(pets) : undefined;

      const reportParams = {
        clientName: clientName || "Unknown Client",
        petName: pet?.name || "Unknown Pet",
        petSpecies: pet?.species || "Dog",
        petBreed: pet?.breed || undefined,
        petAge: pet?.dateOfBirth ? calculateAge(pet.dateOfBirth) : undefined,
        petSex: pet?.sex || undefined,
        consultationDate: consultation.formattedDate,
        transcript: transcriptContent || clinicalNotesContent,
        questionnaire: undefined,
        vetClinicName: reportType === "vet" ? vetClinicName : undefined,
        clientAddress: clientAddress || undefined,
        clientPhone: client?.mobile || undefined,
        clientEmail: client?.email || undefined,
        // Pass comprehensive clinical notes as source of truth for client report
        comprehensiveClinicalReport: clinicalNotesContent || undefined,
        signalment,
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
  const getEmailContent = async () => {
    const templateId = reportType === "client" ? "consultation-report" : "vet-report-cover";
    const template = await getEmailTemplate(templateId);
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
                  <div className="mt-1.5 space-y-2">
                    {/* Vet Clinic Dropdown */}
                    {vetClinics.length > 0 && (
                      <div>
                        <Label className="text-[9px] text-muted-foreground">Select from Directory</Label>
                        <Select
                          value={selectedVetClinicId || ""}
                          onValueChange={handleVetClinicSelect}
                        >
                          <SelectTrigger className="h-7 text-[10px] mt-0.5">
                            <SelectValue placeholder="Choose vet clinic..." />
                          </SelectTrigger>
                          <SelectContent>
                            {vetClinics.map((clinic) => (
                              <SelectItem key={clinic.id} value={clinic.id}>
                                {clinic.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {/* Vet Clinic Name - manual entry or auto-filled from selection */}
                    <div>
                      <Label className="text-[9px] text-muted-foreground">
                        Vet Clinic Name {vetClinics.length > 0 && "(or type manually)"}
                      </Label>
                      <Input
                        value={vetClinicName}
                        onChange={(e) => {
                          setVetClinicName(e.target.value);
                          // Clear selection if user types manually
                          if (selectedVetClinicId) {
                            const clinic = vetClinics.find(vc => vc.id === selectedVetClinicId);
                            if (clinic && e.target.value !== clinic.name) {
                              setSelectedVetClinicId(null);
                            }
                          }
                        }}
                        placeholder="Enter vet clinic name..."
                        className="h-7 text-[10px] mt-0.5"
                      />
                    </div>
                    {/* Show directory hint if empty */}
                    {vetClinics.length === 0 && (
                      <p className="text-[9px] text-muted-foreground italic">
                        Tip: Add vet clinics in Settings → Vet Clinics for quick lookup
                      </p>
                    )}
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
                  const isDocx = report.name.endsWith(".docx");
                  const pdfName = report.name.replace(".docx", ".pdf");
                  const hasPdf = existingReportsForType.some(r => r.name === pdfName);

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
                        {/* Convert to PDF button for DOCX files without existing PDF */}
                        {isDocx && !hasPdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              setIsConvertingPdf(true);
                              try {
                                const pdfPath = report.path.replace(".docx", ".pdf");
                                await invoke("convert_docx_to_pdf", {
                                  docxPath: report.path,
                                  pdfPath
                                });
                                toast.success("PDF created successfully");
                                // Refresh the file list
                                setFileRefreshKey(k => k + 1);
                              } catch (error) {
                                toast.error("Failed to convert to PDF", {
                                  description: error instanceof Error ? error.message : "Make sure MS Word is installed"
                                });
                              } finally {
                                setIsConvertingPdf(false);
                              }
                            }}
                            disabled={isConvertingPdf}
                            className="h-5 px-1.5 text-[9px] text-orange-600 hover:text-orange-700"
                            title="Convert to PDF"
                          >
                            {isConvertingPdf ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            setEmailingReportPath(report.path);
                            const content = await getEmailContent();
                            setEmailContent(content);
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
                onClick={async () => {
                  const content = await getEmailContent();
                  setEmailContent(content);
                  setShowEmailDialog(true);
                }}
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

      {/* Section 5: Task Extraction from Reports */}
      {selectedConsultationId && existingReports.length > 0 && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">TASKS FROM REPORTS</h4>

          {/* Existing tasks for this consultation */}
          {existingTasks.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">
                Existing tasks ({existingTasks.length}):
              </p>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {existingTasks.map(t => (
                  <div key={t.taskId} className="flex items-center gap-1.5 text-[10px]">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      t.status === "Done" ? "bg-green-500" :
                      t.status === "Canceled" ? "bg-gray-400" :
                      "bg-blue-500"
                    }`} />
                    <span className={t.status === "Done" ? "line-through text-muted-foreground" : ""}>
                      {t.description}
                    </span>
                    <span className="text-muted-foreground ml-auto flex-shrink-0">
                      P{t.priority} · {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extract button */}
          {!tasksCreated && (
            <>
              <Button
                onClick={handleExtractTasksFromReports}
                disabled={isExtractingTasks}
                variant="outline"
                className="w-full h-8 text-xs"
              >
                {isExtractingTasks ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Extracting tasks from reports...
                  </>
                ) : (
                  <>
                    <ListTodo className="h-3 w-3 mr-1.5" />
                    Extract Tasks from Reports
                  </>
                )}
              </Button>

              {/* Extracted tasks list */}
              {extractedTasks.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {extractedTasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-2 rounded-md border text-[10px] ${
                        task.isDuplicate
                          ? "bg-amber-50 border-amber-200 opacity-60"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{task.description}</span>
                            {task.isDuplicate && (
                              <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Duplicate
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            Due: +{task.offset} · Priority: {task.priority}
                            {task.context && <> · {task.context}</>}
                          </div>
                          {task.isDuplicate && task.duplicateOf && (
                            <div className="text-[9px] text-amber-600 mt-0.5">
                              Similar to: "{task.duplicateOf}"
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExtractedTasks(prev => prev.filter(t => t.id !== task.id))}
                          className="h-5 w-5 p-0 flex-shrink-0"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Create tasks button */}
                  <Button
                    onClick={handleCreateExtractedTasks}
                    disabled={isCreatingTasks || extractedTasks.filter(t => !t.isDuplicate).length === 0}
                    className="w-full h-8 text-xs mt-2"
                  >
                    {isCreatingTasks ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <ListTodo className="h-3 w-3 mr-1.5" />
                        Create {extractedTasks.filter(t => !t.isDuplicate).length} Task{extractedTasks.filter(t => !t.isDuplicate).length !== 1 ? "s" : ""}
                        {extractedTasks.some(t => t.isDuplicate) && " (excluding duplicates)"}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Success message */}
          {tasksCreated && (
            <div className="p-2 bg-green-50 rounded-md border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-[11px] text-green-800 font-medium">
                  Tasks created from reports
                </p>
              </div>
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

          // Mark consultation as complete in website booking system (bidirectional sync)
          if (fileType === "client" && selectedConsultation) {
            try {
              const syncResult = await markConsultationComplete(clientId, selectedConsultation.date);
              if (syncResult.success) {
                toast.success("Website booking marked as completed", {
                  description: `Booking ${syncResult.bookingReference} updated`,
                  duration: 3000
                });
              }
            } catch (error) {
              // Non-blocking - don't fail the email send if sync fails
              console.warn("Failed to update website booking status:", error);
            }
          }

          setEmailSent(true);
          setEmailingReportPath(null);
        }}
        initialTo={recipientEmail}
        initialSubject={emailContent.subject}
        initialBody={emailContent.body}
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
