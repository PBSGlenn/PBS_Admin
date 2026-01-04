// PBS Admin - Consultation Event Panel Component
// Transcript management and clinical notes generation for consultation events

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { FileCheck, Loader2, FileText, Sparkles, File, FileImage, FileOutput, ExternalLink, ListTodo, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import { updateEvent } from "@/lib/services/eventService";
import { saveTranscriptFile } from "@/lib/services/transcriptFileService";
import { getPetsByClientId } from "@/lib/services/petService";
import { generateAbridgedClinicalNotes, generateComprehensiveClinicalReport } from "@/lib/services/multiReportGenerationService";
import { convertReportToDocxDirectly } from "@/lib/services/docxConversionService";
import { createTask } from "@/lib/services/taskService";
import { calculateDueDate } from "@/lib/utils/dateOffsetUtils";
import { invoke } from "@tauri-apps/api/core";
import { format } from "date-fns";
import { calculateAge } from "@/lib/utils/ageUtils";
import { readFile } from "@tauri-apps/plugin-fs";

// Supported file types for context
type ContextFileType = "txt" | "pdf" | "docx" | "json";

interface ContextFile {
  name: string;
  path: string;
  type: ContextFileType;
  selected: boolean;
}

// Priority type matching TaskPriority
type Priority = 1 | 2 | 3 | 4 | 5;

// Standard post-consultation tasks (pre-checked by default)
interface StandardTask {
  id: string;
  description: string;
  offset: string; // e.g., "5 days", "7 days", "14 days"
  priority: Priority;
  selected: boolean;
}

const DEFAULT_STANDARD_TASKS: StandardTask[] = [
  {
    id: "report",
    description: "Send consultation report to client",
    offset: "5 days",
    priority: 1,
    selected: true
  },
  {
    id: "followup-7",
    description: "Post-consultation follow-up email",
    offset: "7 days",
    priority: 2,
    selected: true
  },
  {
    id: "followup-14",
    description: "2-week post-consultation follow-up email",
    offset: "14 days",
    priority: 2,
    selected: true
  }
];

// Case-specific task extracted from transcript
interface CaseTask {
  id: string;
  description: string;
  offset: string;
  priority: Priority;
  context?: string; // Original context from transcript
}

// Helper to get file extension
function getFileType(filename: string): ContextFileType | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'txt') return 'txt';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'json') return 'json';
  return null;
}

export interface ConsultationEventPanelProps extends EventSpecificPanelProps {
  clientFolderPath?: string;
  clientName?: string;
  onClose?: () => void;
}

export function ConsultationEventPanel({
  clientId,
  event,
  clientFolderPath,
  clientName,
  onSave
}: ConsultationEventPanelProps) {
  const queryClient = useQueryClient();

  // Track transcript text and editing state
  const [transcriptText, setTranscriptText] = useState("");
  const [isEditing, setIsEditing] = useState(!event?.transcriptFilePath);

  // Fetch pets for this client (needed for clinical notes generation)
  const { data: pets = [] } = useQuery({
    queryKey: ["pets", clientId],
    queryFn: () => getPetsByClientId(clientId),
  });

  // Track available txt files in client folder (for transcript selection)
  const [txtFiles, setTxtFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>(event?.transcriptFilePath || "");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Track context files (PDF, DOCX, JSON, other TXT) for AI generation
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);

  // Track whether clinical notes panel is expanded
  const [showClinicalNotesOptions, setShowClinicalNotesOptions] = useState(false);

  // Track whether clinical notes have been generated (to show "Regenerate" button)
  const [hasGeneratedNotes, setHasGeneratedNotes] = useState(false);

  // Track comprehensive clinical notes section state
  const [showComprehensiveOptions, setShowComprehensiveOptions] = useState(false);
  const [hasGeneratedComprehensive, setHasGeneratedComprehensive] = useState(false);
  const [generatedDocxPath, setGeneratedDocxPath] = useState<string | null>(null);
  const [generatedDocxName, setGeneratedDocxName] = useState<string | null>(null);

  // Track task generation section state
  const [showTaskOptions, setShowTaskOptions] = useState(false);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>(DEFAULT_STANDARD_TASKS);
  const [caseTasks, setCaseTasks] = useState<CaseTask[]>([]);
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [hasCreatedTasks, setHasCreatedTasks] = useState(false);

  // Manual task entry state
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskOffset, setNewTaskOffset] = useState("1 week");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>(2);

  // Processing log state - tracks what has been done in this consultation
  const [processingLog, setProcessingLog] = useState<{
    transcriptSaved?: string;
    clinicalNotesGenerated?: string;
    comprehensiveReportGenerated?: string;
    vetReportGenerated?: string;
    tasksCreated?: string;
  }>({});

  // Helper to update event notes with processing log
  // currentNotesContent: Pass the current notes content to avoid stale state issues
  //                      (e.g., when clinical notes were just generated and saved)
  const updateProcessingLog = async (
    newLogEntry: Partial<typeof processingLog>,
    currentNotesContent?: string
  ) => {
    if (!event?.eventId) return;

    const updatedLog = { ...processingLog, ...newLogEntry };
    setProcessingLog(updatedLog);

    // Build the processing log HTML section
    const logEntries: string[] = [];
    if (updatedLog.transcriptSaved) {
      logEntries.push(`<li>✓ Transcript saved: ${updatedLog.transcriptSaved}</li>`);
    }
    if (updatedLog.clinicalNotesGenerated) {
      logEntries.push(`<li>✓ Clinical notes generated: ${updatedLog.clinicalNotesGenerated}</li>`);
    }
    if (updatedLog.comprehensiveReportGenerated) {
      logEntries.push(`<li>✓ Comprehensive report: ${updatedLog.comprehensiveReportGenerated}</li>`);
    }
    if (updatedLog.vetReportGenerated) {
      logEntries.push(`<li>✓ Vet report: ${updatedLog.vetReportGenerated}</li>`);
    }
    if (updatedLog.tasksCreated) {
      logEntries.push(`<li>✓ Tasks created: ${updatedLog.tasksCreated}</li>`);
    }

    // Get existing notes content (without the processing log section)
    // Use passed currentNotesContent if available, otherwise fall back to event.notes
    let existingContent = currentNotesContent ?? event.notes ?? "";
    // Remove existing processing log section if present
    const logMarker = "<!-- PROCESSING_LOG -->";
    const logEndMarker = "<!-- /PROCESSING_LOG -->";
    const logStartIdx = existingContent.indexOf(logMarker);
    if (logStartIdx !== -1) {
      const logEndIdx = existingContent.indexOf(logEndMarker);
      if (logEndIdx !== -1) {
        existingContent = existingContent.substring(0, logStartIdx) + existingContent.substring(logEndIdx + logEndMarker.length);
      }
    }

    // Build the processing log section
    const processingLogHtml = logEntries.length > 0
      ? `${logMarker}<hr/><h3>Processing Log</h3><ul>${logEntries.join("")}</ul>${logEndMarker}`
      : "";

    // Combine existing content with processing log
    const updatedNotes = existingContent.trim() + processingLogHtml;

    try {
      const updatedEvent = await updateEvent(event.eventId, {
        notes: updatedNotes
      });

      // Notify parent of update
      if (onSave && updatedEvent) {
        onSave(updatedEvent);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
    } catch (error) {
      console.error("Failed to update processing log:", error);
    }
  };

  // Load all files from client folder
  useEffect(() => {
    const loadFiles = async () => {
      if (!clientFolderPath) return;

      try {
        const entries = await invoke<Array<{ name: string; isDirectory: boolean }>>(
          "plugin:fs|read_dir",
          { path: clientFolderPath }
        );

        // Filter for .txt files (for transcript dropdown)
        const txtFileList = entries
          .filter(entry => !entry.isDirectory && entry.name.endsWith('.txt'))
          .map(entry => ({
            name: entry.name,
            path: `${clientFolderPath}\\${entry.name}`
          }))
          .sort((a, b) => b.name.localeCompare(a.name)); // Sort newest first (by filename)

        setTxtFiles(txtFileList);

        // Set default selection to saved transcript if available
        if (event?.transcriptFilePath) {
          setSelectedFilePath(event.transcriptFilePath);
        } else if (txtFileList.length > 0) {
          setSelectedFilePath(txtFileList[0].path);
        }

        // Build context files list (PDF, DOCX, JSON, TXT excluding the selected transcript)
        const contextFileList: ContextFile[] = entries
          .filter(entry => {
            if (entry.isDirectory) return false;
            const fileType = getFileType(entry.name);
            return fileType !== null;
          })
          .map(entry => {
            const fileType = getFileType(entry.name)!;
            const filePath = `${clientFolderPath}\\${entry.name}`;
            // Auto-select questionnaire files (PDF or JSON containing 'questionnaire')
            const isQuestionnaire = entry.name.toLowerCase().includes('questionnaire');
            return {
              name: entry.name,
              path: filePath,
              type: fileType,
              selected: isQuestionnaire && (fileType === 'pdf' || fileType === 'json')
            };
          })
          .sort((a, b) => {
            // Sort by type (PDF first, then JSON, TXT, DOCX), then by name
            const typeOrder = { pdf: 0, json: 1, txt: 2, docx: 3 };
            if (typeOrder[a.type] !== typeOrder[b.type]) {
              return typeOrder[a.type] - typeOrder[b.type];
            }
            return a.name.localeCompare(b.name);
          });

        setContextFiles(contextFileList);
      } catch (error) {
        console.error("Failed to load files:", error);
      }
    };

    loadFiles();
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
    onSuccess: (result) => {
      // Clear textarea and switch to confirmation view
      setTranscriptText("");
      setIsEditing(false);

      // Refresh txt files dropdown to show newly saved file
      setRefreshTrigger(prev => prev + 1);

      // Update processing log
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ transcriptSaved: `${result.fileName} (${timestamp})` });

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

  // Toggle context file selection
  const toggleContextFile = (path: string) => {
    setContextFiles(prev =>
      prev.map(file =>
        file.path === path ? { ...file, selected: !file.selected } : file
      )
    );
  };

  // Get files to exclude from context list (the selected transcript)
  const getContextFilesExcludingTranscript = () => {
    return contextFiles.filter(file => file.path !== selectedFilePath);
  };

  // Read file content based on type
  const readFileContent = async (file: ContextFile): Promise<string | null> => {
    try {
      if (file.type === 'txt' || file.type === 'json') {
        // Read text files directly
        const content = await invoke<string>("read_text_file", { filePath: file.path });
        if (file.type === 'json') {
          // Format JSON nicely for context
          try {
            const parsed = JSON.parse(content);
            return `--- ${file.name} ---\n${JSON.stringify(parsed, null, 2)}`;
          } catch {
            return `--- ${file.name} ---\n${content}`;
          }
        }
        return `--- ${file.name} ---\n${content}`;
      } else if (file.type === 'pdf') {
        // Read PDF as base64 for Claude's vision capability
        const bytes = await readFile(file.path);
        const base64 = btoa(String.fromCharCode(...bytes));
        return `[PDF_BASE64:${file.name}]${base64}[/PDF_BASE64]`;
      } else if (file.type === 'docx') {
        // For DOCX, we could use Pandoc to convert to text, but for now skip
        // or extract text - returning null to skip
        return null;
      }
      return null;
    } catch (error) {
      console.error(`Failed to read file ${file.name}:`, error);
      return null;
    }
  };

  // Clinical notes generation mutation
  const generateClinicalNotesMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId) {
        throw new Error("Event must be saved first");
      }

      if (!selectedFilePath) {
        throw new Error("No transcript file selected");
      }

      // Read transcript file content
      const transcriptContent = await invoke<string>("read_text_file", {
        filePath: selectedFilePath
      });

      if (!transcriptContent || transcriptContent.trim().length < 100) {
        throw new Error("Transcript content is too short (minimum 100 characters)");
      }

      // Read selected context files (excluding the transcript itself)
      const selectedContextFiles = getContextFilesExcludingTranscript().filter(f => f.selected);
      const contextContents: string[] = [];

      for (const file of selectedContextFiles) {
        const content = await readFileContent(file);
        if (content) {
          contextContents.push(content);
        }
      }

      // Combine questionnaire/context data
      const questionnaireData = contextContents.length > 0
        ? contextContents.join('\n\n')
        : undefined;

      // Get first pet (or allow selection in future)
      const pet = pets[0];
      if (!pet) {
        throw new Error("No pet found for this client");
      }

      // Format consultation date
      const consultationDate = event.date
        ? format(new Date(event.date), "d MMMM yyyy")
        : format(new Date(), "d MMMM yyyy");

      // Calculate pet age if DOB available
      const petAge = pet.dateOfBirth ? calculateAge(pet.dateOfBirth) : undefined;

      // Generate clinical notes using AI
      const result = await generateAbridgedClinicalNotes({
        clientName: clientName || "Unknown Client",
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed || undefined,
        petAge: petAge,
        petSex: pet.sex || undefined,
        consultationDate: consultationDate,
        transcript: transcriptContent,
        questionnaire: questionnaireData
      });

      // Update event with generated notes (HTML format) and get updated event back
      const updatedEvent = await updateEvent(event.eventId, {
        notes: result.content
      });

      return { ...result, contextFilesUsed: selectedContextFiles.length, updatedEvent };
    },
    onSuccess: (result) => {
      const contextMsg = result.contextFilesUsed > 0
        ? ` with ${result.contextFilesUsed} context file${result.contextFilesUsed > 1 ? 's' : ''}`
        : '';
      toast.success("Clinical notes generated", {
        description: `Used ${result.tokensUsed.total.toLocaleString()} tokens${contextMsg}`
      });

      // Collapse the options panel back to single button and mark as generated
      setShowClinicalNotesOptions(false);
      setHasGeneratedNotes(true);

      // Update processing log - pass the generated clinical notes content
      // so the log is appended to the actual notes, not stale event.notes
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ clinicalNotesGenerated: timestamp }, result.content);

      // Note: updateProcessingLog will call onSave with the updated event
      // which includes both the clinical notes and the processing log

      // Invalidate queries to refresh event data with new notes
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      toast.error("Failed to generate clinical notes", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const handleGenerateClinicalNotes = () => {
    if (!selectedFilePath) {
      toast.error("Please select a transcript file first");
      return;
    }

    generateClinicalNotesMutation.mutate();
  };

  // Comprehensive clinical notes generation mutation (saves as DOCX)
  const generateComprehensiveMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId) {
        throw new Error("Event must be saved first");
      }

      if (!selectedFilePath) {
        throw new Error("No transcript file selected");
      }

      if (!clientFolderPath || !clientName) {
        throw new Error("Client folder path is required");
      }

      // Read transcript file content
      const transcriptContent = await invoke<string>("read_text_file", {
        filePath: selectedFilePath
      });

      if (!transcriptContent || transcriptContent.trim().length < 100) {
        throw new Error("Transcript content is too short (minimum 100 characters)");
      }

      // Read selected context files (excluding the transcript itself)
      const selectedContextFiles = getContextFilesExcludingTranscript().filter(f => f.selected);
      const contextContents: string[] = [];

      for (const file of selectedContextFiles) {
        const content = await readFileContent(file);
        if (content) {
          contextContents.push(content);
        }
      }

      // Combine questionnaire/context data
      const questionnaireData = contextContents.length > 0
        ? contextContents.join('\n\n')
        : undefined;

      // Get first pet
      const pet = pets[0];
      if (!pet) {
        throw new Error("No pet found for this client");
      }

      // Format consultation date for display
      const consultationDate = event.date
        ? format(new Date(event.date), "d MMMM yyyy")
        : format(new Date(), "d MMMM yyyy");

      // Format consultation date for filename (YYYYMMDD)
      const consultationDateForFile = event.date
        ? format(new Date(event.date), "yyyyMMdd")
        : format(new Date(), "yyyyMMdd");

      // Calculate pet age if DOB available
      const petAge = pet.dateOfBirth ? calculateAge(pet.dateOfBirth) : undefined;

      // Extract client surname for filename
      const clientSurname = clientName.split(' ').pop() || clientName;

      // Generate comprehensive clinical report using AI
      const result = await generateComprehensiveClinicalReport({
        clientName: clientName,
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed || undefined,
        petAge: petAge,
        petSex: pet.sex || undefined,
        consultationDate: consultationDate,
        transcript: transcriptContent,
        questionnaire: questionnaireData
      });

      // Convert to DOCX directly (no intermediate markdown file)
      const docxResult = await convertReportToDocxDirectly({
        markdownContent: result.content,
        clientId: clientId,
        clientSurname: clientSurname.toLowerCase(),
        consultationDate: consultationDateForFile,
        reportType: 'practitionerReport',
        version: 1,
        clientFolderPath: clientFolderPath
      });

      if (!docxResult.success) {
        throw new Error(docxResult.error || "Failed to convert to DOCX");
      }

      return {
        ...result,
        docxFileName: docxResult.docxFileName,
        docxFilePath: docxResult.docxFilePath,
        contextFilesUsed: selectedContextFiles.length
      };
    },
    onSuccess: (result) => {
      const contextMsg = result.contextFilesUsed > 0
        ? ` with ${result.contextFilesUsed} context file${result.contextFilesUsed > 1 ? 's' : ''}`
        : '';
      toast.success("Comprehensive report generated", {
        description: `Saved as ${result.docxFileName}${contextMsg}`
      });

      // Store generated file info for display
      setGeneratedDocxPath(result.docxFilePath);
      setGeneratedDocxName(result.docxFileName);

      // Collapse the options panel back to single button and mark as generated
      setShowComprehensiveOptions(false);
      setHasGeneratedComprehensive(true);

      // Update processing log
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ comprehensiveReportGenerated: `${result.docxFileName} (${timestamp})` });

      // Invalidate queries to refresh event data
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      toast.error("Failed to generate comprehensive report", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const handleGenerateComprehensive = () => {
    if (!selectedFilePath) {
      toast.error("Please select a transcript file first");
      return;
    }

    generateComprehensiveMutation.mutate();
  };

  // Open generated DOCX file
  const handleOpenDocx = async () => {
    if (!generatedDocxPath) return;
    try {
      await invoke("plugin:opener|open_path", { path: generatedDocxPath });
    } catch (error) {
      toast.error("Failed to open document", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Toggle standard task selection
  const toggleStandardTask = (taskId: string) => {
    setStandardTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, selected: !task.selected } : task
      )
    );
  };

  // Remove a case-specific task
  const removeCaseTask = (taskId: string) => {
    setCaseTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // Add a manual case-specific task
  const handleAddManualTask = () => {
    if (!newTaskDescription.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    const newTask: CaseTask = {
      id: `manual-${Date.now()}`,
      description: newTaskDescription.trim(),
      offset: newTaskOffset,
      priority: newTaskPriority,
      context: "Manually added"
    };

    setCaseTasks(prev => [...prev, newTask]);
    setNewTaskDescription("");
    setNewTaskOffset("1 week");
    setNewTaskPriority(2);
    setShowAddTaskForm(false);
    toast.success("Task added");
  };

  // Extract case-specific tasks from transcript using AI
  const handleExtractTasks = async () => {
    if (!selectedFilePath) {
      toast.error("Please select a transcript file first");
      return;
    }

    setIsExtractingTasks(true);

    try {
      // Read transcript content
      const transcriptContent = await invoke<string>("read_text_file", {
        filePath: selectedFilePath
      });

      // Also use clinical notes if available (from event.notes)
      const clinicalNotes = event?.notes || "";

      // Call Claude API to extract tasks
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `You are a veterinary behaviour consultant's assistant. Extract ONLY practitioner tasks (things the vet needs to do) from this consultation transcript and notes. Do NOT include client homework or pet training exercises.

Common practitioner tasks include:
- Send vet report/letter to referring vet
- Schedule follow-up consultation
- Send specific resources or protocols
- Contact referring vet about medication
- Review case in X weeks
- Prepare training plan document

Return a JSON array of tasks. Each task should have:
- description: Clear, actionable task description
- offset: When due relative to consultation (e.g., "3 days", "1 week", "2 weeks")
- priority: 1-5 (1 = highest priority)
- context: Brief quote or reference from transcript explaining why this task is needed

If no case-specific tasks are found, return an empty array: []

TRANSCRIPT:
${transcriptContent.substring(0, 15000)}

${clinicalNotes ? `CLINICAL NOTES:\n${clinicalNotes.substring(0, 5000)}` : ""}

Return ONLY valid JSON array, no other text.`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      let content = data.content[0]?.text || "[]";

      // Strip markdown code blocks if present (```json ... ```)
      content = content.trim();
      if (content.startsWith("```")) {
        // Remove opening ```json or ``` and closing ```
        content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      // Parse the JSON response
      try {
        const extractedTasks = JSON.parse(content);
        if (Array.isArray(extractedTasks)) {
          const tasksWithIds: CaseTask[] = extractedTasks.map((task: any, index: number) => {
            // Ensure priority is within valid range (1-5)
            const rawPriority = Number(task.priority) || 2;
            const priority = Math.max(1, Math.min(5, rawPriority)) as Priority;
            return {
              id: `case-${Date.now()}-${index}`,
              description: task.description || "",
              offset: task.offset || "1 week",
              priority,
              context: task.context || ""
            };
          });
          setCaseTasks(tasksWithIds);
          toast.success(`Extracted ${tasksWithIds.length} case-specific task${tasksWithIds.length !== 1 ? 's' : ''}`);
        }
      } catch (parseError) {
        console.error("Failed to parse task extraction response:", content);
        toast.error("Failed to parse AI response");
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

  // Create all selected tasks
  const createTasksMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId || !event?.date) {
        throw new Error("Event must be saved first");
      }

      const consultationDate = event.date;
      const tasksToCreate: Array<{ description: string; dueDate: string; priority: Priority }> = [];

      // Add selected standard tasks
      for (const task of standardTasks) {
        if (task.selected) {
          tasksToCreate.push({
            description: task.description,
            dueDate: calculateDueDate(consultationDate, task.offset),
            priority: task.priority
          });
        }
      }

      // Add all case-specific tasks
      for (const task of caseTasks) {
        tasksToCreate.push({
          description: task.description,
          dueDate: calculateDueDate(consultationDate, task.offset),
          priority: task.priority
        });
      }

      if (tasksToCreate.length === 0) {
        throw new Error("No tasks selected to create");
      }

      // Create all tasks
      const createdTasks = [];
      for (const task of tasksToCreate) {
        const created = await createTask({
          clientId: clientId,
          eventId: event.eventId,
          description: task.description,
          dueDate: task.dueDate,
          status: "Pending",
          priority: task.priority,
          triggeredBy: "Consultation",
          automatedAction: "PostConsultation"
        });
        createdTasks.push(created);
      }

      return createdTasks;
    },
    onSuccess: (createdTasks) => {
      toast.success(`Created ${createdTasks.length} task${createdTasks.length !== 1 ? 's' : ''}`);
      setShowTaskOptions(false);
      setHasCreatedTasks(true);

      // Update processing log with task count
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ tasksCreated: `${createdTasks.length} task${createdTasks.length !== 1 ? 's' : ''} (${timestamp})` });

      // Invalidate queries to refresh task lists
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      toast.error("Failed to create tasks", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const handleCreateTasks = () => {
    createTasksMutation.mutate();
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

      {/* Clinical Notes Generation Section - Only show when transcript is saved */}
      {!isEditing && selectedFilePath && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">CLINICAL NOTES</h4>

          {!showClinicalNotesOptions ? (
            // Collapsed state - show button to expand (different text if already generated)
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClinicalNotesOptions(true)}
              disabled={pets.length === 0}
              className="h-8 text-xs w-full"
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              {hasGeneratedNotes ? "Regenerate Clinical Notes" : "Generate Clinical Notes from Transcript"}
            </Button>
          ) : (
            // Expanded state - show file selection and generate button
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Generate clinical notes from the transcript using AI.
              </p>

              {/* Context Files Selection */}
              {getContextFilesExcludingTranscript().length > 0 && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Additional Context Files (optional)
                  </Label>
                  <div className="mt-1.5 space-y-1 max-h-[120px] overflow-y-auto border rounded-md p-2 bg-muted/30">
                    {getContextFilesExcludingTranscript().map((file) => (
                      <label
                        key={file.path}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                      >
                        <Checkbox
                          checked={file.selected}
                          onCheckedChange={() => toggleContextFile(file.path)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1.5 text-[10px] truncate flex-1">
                          {file.type === 'pdf' && <FileImage className="h-3 w-3 text-red-500 flex-shrink-0" />}
                          {file.type === 'json' && <File className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
                          {file.type === 'txt' && <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                          {file.type === 'docx' && <File className="h-3 w-3 text-blue-700 flex-shrink-0" />}
                          <span className="truncate">{file.name}</span>
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase flex-shrink-0">
                          {file.type}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {getContextFilesExcludingTranscript().filter(f => f.selected).length} file(s) selected
                    {' • '}Questionnaires auto-selected
                  </p>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleGenerateClinicalNotes}
                disabled={generateClinicalNotesMutation.isPending || !selectedFilePath || pets.length === 0}
                className="h-8 text-xs w-full bg-violet-600 hover:bg-violet-700"
              >
                {generateClinicalNotesMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Generating Clinical Notes...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1.5" />
                    Generate Clinical Notes
                  </>
                )}
              </Button>
            </div>
          )}

          {pets.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-2">
              ⚠ No pets found for this client - add a pet first
            </p>
          )}
        </Card>
      )}

      {/* Comprehensive Clinical Notes Section - Only show when transcript is saved */}
      {!isEditing && selectedFilePath && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">COMPREHENSIVE CLINICAL NOTES</h4>

          {/* Success state - show generated file with open button */}
          {hasGeneratedComprehensive && generatedDocxName && !showComprehensiveOptions && (
            <div className="space-y-2">
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <FileCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-green-800 font-medium">
                      Report generated successfully
                    </p>
                    <p className="text-[10px] text-green-700 mt-1 break-all">
                      {generatedDocxName}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleOpenDocx}
                  className="h-7 text-xs flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="h-3 w-3 mr-1.5" />
                  Open Document
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowComprehensiveOptions(true)}
                  className="h-7 text-xs"
                >
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          {/* Initial state - show button to expand */}
          {!showComprehensiveOptions && !hasGeneratedComprehensive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComprehensiveOptions(true)}
              disabled={pets.length === 0 || !clientFolderPath}
              className="h-8 text-xs w-full"
            >
              <FileOutput className="h-3 w-3 mr-1.5" />
              Generate Comprehensive Report (DOCX)
            </Button>
          )}

          {/* Expanded state - show file selection and generate button */}
          {showComprehensiveOptions && (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Generate a detailed clinical report (3-5 pages) and save as DOCX in the client folder.
              </p>

              {/* Context Files Selection */}
              {getContextFilesExcludingTranscript().length > 0 && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Additional Context Files (optional)
                  </Label>
                  <div className="mt-1.5 space-y-1 max-h-[120px] overflow-y-auto border rounded-md p-2 bg-muted/30">
                    {getContextFilesExcludingTranscript().map((file) => (
                      <label
                        key={file.path}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                      >
                        <Checkbox
                          checked={file.selected}
                          onCheckedChange={() => toggleContextFile(file.path)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1.5 text-[10px] truncate flex-1">
                          {file.type === 'pdf' && <FileImage className="h-3 w-3 text-red-500 flex-shrink-0" />}
                          {file.type === 'json' && <File className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
                          {file.type === 'txt' && <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                          {file.type === 'docx' && <File className="h-3 w-3 text-blue-700 flex-shrink-0" />}
                          <span className="truncate">{file.name}</span>
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase flex-shrink-0">
                          {file.type}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {getContextFilesExcludingTranscript().filter(f => f.selected).length} file(s) selected
                  </p>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleGenerateComprehensive}
                disabled={generateComprehensiveMutation.isPending || !selectedFilePath || pets.length === 0 || !clientFolderPath}
                className="h-8 text-xs w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {generateComprehensiveMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileOutput className="h-3 w-3 mr-1.5" />
                    Generate Comprehensive Report (DOCX)
                  </>
                )}
              </Button>
            </div>
          )}

          {pets.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-2">
              ⚠ No pets found for this client - add a pet first
            </p>
          )}

          {!clientFolderPath && (
            <p className="text-[10px] text-amber-600 mt-2">
              ⚠ Client folder required - create folder first
            </p>
          )}
        </Card>
      )}

      {/* Post-Consultation Tasks Section - Only show when transcript is saved */}
      {!isEditing && selectedFilePath && (
        <Card className="p-3">
          <h4 className="text-xs font-semibold mb-2">POST-CONSULTATION TASKS</h4>

          {/* Success state - tasks created */}
          {hasCreatedTasks && !showTaskOptions && (
            <div className="space-y-2">
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <FileCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-green-800 font-medium">
                      Tasks created successfully
                    </p>
                    <p className="text-[10px] text-green-700 mt-1">
                      Tasks have been added to your task list
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTaskOptions(true);
                  setHasCreatedTasks(false);
                  setStandardTasks(DEFAULT_STANDARD_TASKS);
                  setCaseTasks([]);
                }}
                className="h-7 text-xs w-full"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Create More Tasks
              </Button>
            </div>
          )}

          {/* Initial state - show button to expand */}
          {!showTaskOptions && !hasCreatedTasks && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTaskOptions(true)}
              disabled={!event?.eventId}
              className="h-8 text-xs w-full"
            >
              <ListTodo className="h-3 w-3 mr-1.5" />
              Create Post-Consultation Tasks
            </Button>
          )}

          {/* Expanded state - show task selection */}
          {showTaskOptions && (
            <div className="space-y-4">
              {/* Standard Tasks Section */}
              <div>
                <Label className="text-[10px] text-muted-foreground font-semibold">
                  Standard Follow-up Tasks
                </Label>
                <p className="text-[9px] text-muted-foreground mb-2">
                  Uncheck any tasks you don't want to create
                </p>
                <div className="space-y-1.5 border rounded-md p-2 bg-muted/30">
                  {standardTasks.map((task) => (
                    <label
                      key={task.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-1"
                    >
                      <Checkbox
                        checked={task.selected}
                        onCheckedChange={() => toggleStandardTask(task.id)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="flex-1 text-[10px]">{task.description}</span>
                      <span className="text-[9px] text-muted-foreground">
                        +{task.offset}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Case-Specific Tasks Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground font-semibold">
                      Case-Specific Tasks
                    </Label>
                    <p className="text-[9px] text-muted-foreground">
                      Tasks extracted from the transcript
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExtractTasks}
                    disabled={isExtractingTasks}
                    className="h-6 text-[10px] px-2"
                  >
                    {isExtractingTasks ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {caseTasks.length > 0 ? "Re-extract" : "Extract from Transcript"}
                      </>
                    )}
                  </Button>
                </div>

                {caseTasks.length > 0 ? (
                  <div className="space-y-1.5 border rounded-md p-2 bg-blue-50/50">
                    {caseTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-2 bg-white rounded px-2 py-1.5 border border-blue-100"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium">{task.description}</p>
                          {task.context && task.context !== "Manually added" && (
                            <p className="text-[9px] text-muted-foreground mt-0.5 italic truncate">
                              "{task.context}"
                            </p>
                          )}
                          {task.context === "Manually added" && (
                            <p className="text-[9px] text-blue-600 mt-0.5">
                              Manual
                            </p>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          +{task.offset}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCaseTask(task.id)}
                          className="h-5 w-5 p-0 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-md p-3 bg-muted/20 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Click "Extract from Transcript" or add tasks manually
                    </p>
                  </div>
                )}

                {/* Manual Task Entry */}
                {!showAddTaskForm ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddTaskForm(true)}
                    className="h-6 text-[10px] w-full text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Task Manually
                  </Button>
                ) : (
                  <div className="border rounded-md p-2 bg-muted/20 space-y-2">
                    <div>
                      <Label className="text-[9px] text-muted-foreground">Description</Label>
                      <Textarea
                        value={newTaskDescription}
                        onChange={(e) => setNewTaskDescription(e.target.value)}
                        placeholder="Enter task description..."
                        className="h-16 text-[10px] resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-[9px] text-muted-foreground">Due</Label>
                        <Select value={newTaskOffset} onValueChange={setNewTaskOffset}>
                          <SelectTrigger className="h-7 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1 day">+1 day</SelectItem>
                            <SelectItem value="2 days">+2 days</SelectItem>
                            <SelectItem value="3 days">+3 days</SelectItem>
                            <SelectItem value="5 days">+5 days</SelectItem>
                            <SelectItem value="1 week">+1 week</SelectItem>
                            <SelectItem value="2 weeks">+2 weeks</SelectItem>
                            <SelectItem value="3 weeks">+3 weeks</SelectItem>
                            <SelectItem value="4 weeks">+4 weeks</SelectItem>
                            <SelectItem value="6 weeks">+6 weeks</SelectItem>
                            <SelectItem value="8 weeks">+8 weeks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-[9px] text-muted-foreground">Priority</Label>
                        <Select
                          value={String(newTaskPriority)}
                          onValueChange={(v) => setNewTaskPriority(Number(v) as Priority)}
                        >
                          <SelectTrigger className="h-7 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Highest</SelectItem>
                            <SelectItem value="2">2 - High</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - Low</SelectItem>
                            <SelectItem value="5">5 - Lowest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddTaskForm(false);
                          setNewTaskDescription("");
                        }}
                        className="h-6 text-[10px] flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddManualTask}
                        disabled={!newTaskDescription.trim()}
                        className="h-6 text-[10px] flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Task
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Task count summary */}
              <div className="text-[10px] text-muted-foreground text-center py-1 border-t">
                {standardTasks.filter(t => t.selected).length + caseTasks.length} task(s) will be created
              </div>

              {/* Create Tasks Button */}
              <Button
                size="sm"
                onClick={handleCreateTasks}
                disabled={
                  createTasksMutation.isPending ||
                  (standardTasks.filter(t => t.selected).length === 0 && caseTasks.length === 0)
                }
                className="h-8 text-xs w-full bg-orange-600 hover:bg-orange-700"
              >
                {createTasksMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Creating Tasks...
                  </>
                ) : (
                  <>
                    <ListTodo className="h-3 w-3 mr-1.5" />
                    Create {standardTasks.filter(t => t.selected).length + caseTasks.length} Task(s)
                  </>
                )}
              </Button>
            </div>
          )}

          {!event?.eventId && (
            <p className="text-[10px] text-amber-600 mt-2">
              ⚠ Save the event first before creating tasks
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
