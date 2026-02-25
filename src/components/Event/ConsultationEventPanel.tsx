// PBS Admin - Consultation Event Panel Component
// Transcript management and clinical notes generation for consultation events
// Sub-components in ./consultation/ handle individual UI sections

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { calculateAge } from "@/lib/utils/ageUtils";
import { calculateDueDate } from "@/lib/utils/dateOffsetUtils";
import { updateEvent } from "@/lib/services/eventService";
import { saveTranscriptFile } from "@/lib/services/transcriptFileService";
import { getPetsByClientId } from "@/lib/services/petService";
import { generateAbridgedClinicalNotes, generateComprehensiveClinicalReport } from "@/lib/services/multiReportGenerationService";
import { convertReportToDocxDirectly } from "@/lib/services/docxConversionService";
import { createTask } from "@/lib/services/taskService";
import { getAnthropicApiKey, getAIModelConfig } from "@/lib/services/apiKeysService";
import type { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import {
  TranscriptSection,
  ClinicalNotesSection,
  ComprehensiveNotesSection,
  PostConsultationTasksSection,
  DEFAULT_STANDARD_TASKS,
  getFileType,
} from "./consultation";
import type {
  ContextFile,
  StandardTask,
  CaseTask,
  Priority,
  ProcessingLog,
} from "./consultation";

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

  // ============================================================================
  // State
  // ============================================================================

  // Transcript state
  const [transcriptText, setTranscriptText] = useState("");
  const [isEditing, setIsEditing] = useState(!event?.transcriptFilePath);
  const [txtFiles, setTxtFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>(event?.transcriptFilePath || "");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);

  // Context files state
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);

  // Clinical notes state
  const [showClinicalNotesOptions, setShowClinicalNotesOptions] = useState(false);
  const [hasGeneratedNotes, setHasGeneratedNotes] = useState(false);

  // Comprehensive notes state
  const [showComprehensiveOptions, setShowComprehensiveOptions] = useState(false);
  const [hasGeneratedComprehensive, setHasGeneratedComprehensive] = useState(false);
  const [generatedDocxPath, setGeneratedDocxPath] = useState<string | null>(null);
  const [generatedDocxName, setGeneratedDocxName] = useState<string | null>(null);

  // Task generation state
  const [showTaskOptions, setShowTaskOptions] = useState(false);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>(DEFAULT_STANDARD_TASKS);
  const [caseTasks, setCaseTasks] = useState<CaseTask[]>([]);
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [hasCreatedTasks, setHasCreatedTasks] = useState(false);

  // Processing log
  const [processingLog, setProcessingLog] = useState<ProcessingLog>({});

  // ============================================================================
  // Queries
  // ============================================================================

  const { data: pets = [] } = useQuery({
    queryKey: ["pets", clientId],
    queryFn: () => getPetsByClientId(clientId),
  });

  // ============================================================================
  // Helpers
  // ============================================================================

  // Read file content based on type (for context files)
  const readFileContent = useCallback(async (file: ContextFile): Promise<string | null> => {
    try {
      if (file.type === 'txt' || file.type === 'json') {
        const content = await invoke<string>("read_text_file", { filePath: file.path });
        if (file.type === 'json') {
          try {
            const parsed = JSON.parse(content);
            return `--- ${file.name} ---\n${JSON.stringify(parsed, null, 2)}`;
          } catch {
            return `--- ${file.name} ---\n${content}`;
          }
        }
        return `--- ${file.name} ---\n${content}`;
      } else if (file.type === 'pdf') {
        const bytes = await readFile(file.path);
        const base64 = btoa(String.fromCharCode(...bytes));
        return `[PDF_BASE64:${file.name}]${base64}[/PDF_BASE64]`;
      }
      return null;
    } catch (error) {
      console.error(`Failed to read file ${file.name}:`, error);
      return null;
    }
  }, []);

  // Get selected context files excluding the transcript
  const getSelectedContextContents = useCallback(async (): Promise<string | undefined> => {
    const selectedContextFiles = contextFiles.filter(
      f => f.path !== selectedFilePath && f.selected
    );
    if (selectedContextFiles.length === 0) return undefined;

    const contents: string[] = [];
    for (const file of selectedContextFiles) {
      const content = await readFileContent(file);
      if (content) contents.push(content);
    }
    return contents.length > 0 ? contents.join('\n\n') : undefined;
  }, [contextFiles, selectedFilePath, readFileContent]);

  // Get pet and consultation info for AI generation
  const getGenerationParams = useCallback(() => {
    const pet = pets[0];
    if (!pet) return null;

    const consultationDate = event?.date
      ? format(new Date(event.date), "d MMMM yyyy")
      : format(new Date(), "d MMMM yyyy");

    const petAge = pet.dateOfBirth ? calculateAge(pet.dateOfBirth) : undefined;

    return { pet, consultationDate, petAge };
  }, [pets, event?.date]);

  // Update event notes with processing log
  const updateProcessingLog = useCallback(async (
    newLogEntry: Partial<ProcessingLog>,
    currentNotesContent?: string
  ) => {
    if (!event?.eventId) return;

    const updatedLog = { ...processingLog, ...newLogEntry };
    setProcessingLog(updatedLog);

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

    let existingContent = currentNotesContent ?? event.notes ?? "";
    const logMarker = "<!-- PROCESSING_LOG -->";
    const logEndMarker = "<!-- /PROCESSING_LOG -->";
    const logStartIdx = existingContent.indexOf(logMarker);
    if (logStartIdx !== -1) {
      const logEndIdx = existingContent.indexOf(logEndMarker);
      if (logEndIdx !== -1) {
        existingContent = existingContent.substring(0, logStartIdx) + existingContent.substring(logEndIdx + logEndMarker.length);
      }
    }

    const processingLogHtml = logEntries.length > 0
      ? `${logMarker}<hr/><h3>Processing Log</h3><ul>${logEntries.join("")}</ul>${logEndMarker}`
      : "";

    const updatedNotes = existingContent.trim() + processingLogHtml;

    try {
      const updatedEvent = await updateEvent(event.eventId, { notes: updatedNotes });
      if (onSave && updatedEvent) onSave(updatedEvent);
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
    } catch (error) {
      console.error("Failed to update processing log:", error);
    }
  }, [event?.eventId, event?.notes, processingLog, onSave, clientId, queryClient]);

  // ============================================================================
  // Effects
  // ============================================================================

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
          .sort((a, b) => b.name.localeCompare(a.name));

        setTxtFiles(txtFileList);

        if (event?.transcriptFilePath) {
          setSelectedFilePath(event.transcriptFilePath);
        } else if (txtFileList.length > 0) {
          setSelectedFilePath(txtFileList[0].path);
        }

        // Build context files list
        const contextFileList: ContextFile[] = entries
          .filter(entry => {
            if (entry.isDirectory) return false;
            return getFileType(entry.name) !== null;
          })
          .map(entry => {
            const fileType = getFileType(entry.name)!;
            const filePath = `${clientFolderPath}\\${entry.name}`;
            const isQuestionnaire = entry.name.toLowerCase().includes('questionnaire');
            return {
              name: entry.name,
              path: filePath,
              type: fileType,
              selected: isQuestionnaire && (fileType === 'pdf' || fileType === 'json')
            };
          })
          .sort((a, b) => {
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

  // ============================================================================
  // Mutations
  // ============================================================================

  // Save transcript
  const saveTranscriptMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId || !clientFolderPath || !clientName) {
        throw new Error("Cannot save transcript: Event not created or missing client info");
      }
      if (!transcriptText || transcriptText.trim().length < 10) {
        throw new Error("Transcript must be at least 10 characters");
      }

      const clientSurname = clientName.split(' ').pop() || clientName;
      const consultationDate = event.date || new Date().toISOString();

      const result = await saveTranscriptFile(
        clientFolderPath,
        clientSurname.toLowerCase(),
        consultationDate,
        transcriptText
      );
      if (!result.success) throw new Error(result.error || "Failed to save transcript file");

      await updateEvent(event.eventId, { transcriptFilePath: result.filePath });
      return { filePath: result.filePath, fileName: result.fileName };
    },
    onSuccess: (result) => {
      setTranscriptText("");
      setIsEditing(false);
      setRefreshTrigger(prev => prev + 1);
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ transcriptSaved: `${result.fileName} (${timestamp})` });
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      toast.error("Failed to save transcript", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate abridged clinical notes
  const generateClinicalNotesMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId) throw new Error("Event must be saved first");
      if (!selectedFilePath) throw new Error("No transcript file selected");

      const transcriptContent = await invoke<string>("read_text_file", { filePath: selectedFilePath });
      if (!transcriptContent || transcriptContent.trim().length < 100) {
        throw new Error("Transcript content is too short (minimum 100 characters)");
      }

      const questionnaireData = await getSelectedContextContents();
      const params = getGenerationParams();
      if (!params) throw new Error("No pet found for this client");

      const result = await generateAbridgedClinicalNotes({
        clientName: clientName || "Unknown Client",
        petName: params.pet.name,
        petSpecies: params.pet.species,
        petBreed: params.pet.breed || undefined,
        petAge: params.petAge,
        petSex: params.pet.sex || undefined,
        consultationDate: params.consultationDate,
        transcript: transcriptContent,
        questionnaire: questionnaireData
      });

      await updateEvent(event.eventId, { notes: result.content });

      const selectedCount = contextFiles.filter(f => f.path !== selectedFilePath && f.selected).length;
      return { ...result, contextFilesUsed: selectedCount };
    },
    onSuccess: (result) => {
      const contextMsg = result.contextFilesUsed > 0
        ? ` with ${result.contextFilesUsed} context file${result.contextFilesUsed > 1 ? 's' : ''}`
        : '';
      toast.success("Clinical notes generated", {
        description: `Used ${result.tokensUsed.total.toLocaleString()} tokens${contextMsg}`
      });
      setShowClinicalNotesOptions(false);
      setHasGeneratedNotes(true);
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ clinicalNotesGenerated: timestamp }, result.content);
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      toast.error("Failed to generate clinical notes", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Generate comprehensive clinical report (DOCX)
  const generateComprehensiveMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId) throw new Error("Event must be saved first");
      if (!selectedFilePath) throw new Error("No transcript file selected");
      if (!clientFolderPath || !clientName) throw new Error("Client folder path is required");

      const transcriptContent = await invoke<string>("read_text_file", { filePath: selectedFilePath });
      if (!transcriptContent || transcriptContent.trim().length < 100) {
        throw new Error("Transcript content is too short (minimum 100 characters)");
      }

      const questionnaireData = await getSelectedContextContents();
      const params = getGenerationParams();
      if (!params) throw new Error("No pet found for this client");

      const consultationDateForFile = event.date
        ? format(new Date(event.date), "yyyyMMdd")
        : format(new Date(), "yyyyMMdd");
      const clientSurname = clientName.split(' ').pop() || clientName;

      const result = await generateComprehensiveClinicalReport({
        clientName,
        petName: params.pet.name,
        petSpecies: params.pet.species,
        petBreed: params.pet.breed || undefined,
        petAge: params.petAge,
        petSex: params.pet.sex || undefined,
        consultationDate: params.consultationDate,
        transcript: transcriptContent,
        questionnaire: questionnaireData
      });

      const docxResult = await convertReportToDocxDirectly({
        markdownContent: result.content,
        clientId,
        clientSurname: clientSurname.toLowerCase(),
        consultationDate: consultationDateForFile,
        reportType: 'practitionerReport',
        version: 1,
        clientFolderPath
      });

      if (!docxResult.success) throw new Error(docxResult.error || "Failed to convert to DOCX");

      const selectedCount = contextFiles.filter(f => f.path !== selectedFilePath && f.selected).length;
      return {
        ...result,
        docxFileName: docxResult.docxFileName,
        docxFilePath: docxResult.docxFilePath,
        contextFilesUsed: selectedCount
      };
    },
    onSuccess: (result) => {
      const contextMsg = result.contextFilesUsed > 0
        ? ` with ${result.contextFilesUsed} context file${result.contextFilesUsed > 1 ? 's' : ''}`
        : '';
      toast.success("Comprehensive report generated", {
        description: `Saved as ${result.docxFileName}${contextMsg}`
      });
      setGeneratedDocxPath(result.docxFilePath);
      setGeneratedDocxName(result.docxFileName);
      setShowComprehensiveOptions(false);
      setHasGeneratedComprehensive(true);
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ comprehensiveReportGenerated: `${result.docxFileName} (${timestamp})` });
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      toast.error("Failed to generate comprehensive report", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create all selected tasks
  const createTasksMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId || !event?.date) throw new Error("Event must be saved first");

      const consultationDate = event.date;
      const tasksToCreate: Array<{ description: string; dueDate: string; priority: Priority }> = [];

      for (const task of standardTasks) {
        if (task.selected) {
          tasksToCreate.push({
            description: task.description,
            dueDate: calculateDueDate(consultationDate, task.offset),
            priority: task.priority
          });
        }
      }
      for (const task of caseTasks) {
        tasksToCreate.push({
          description: task.description,
          dueDate: calculateDueDate(consultationDate, task.offset),
          priority: task.priority
        });
      }

      if (tasksToCreate.length === 0) throw new Error("No tasks selected to create");

      const createdTasks = [];
      for (const task of tasksToCreate) {
        const created = await createTask({
          clientId,
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
      const timestamp = format(new Date(), "d MMM yyyy HH:mm");
      updateProcessingLog({ tasksCreated: `${createdTasks.length} task${createdTasks.length !== 1 ? 's' : ''} (${timestamp})` });
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

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSaveTranscript = useCallback(() => {
    if (event?.transcriptFilePath) {
      setIsReplaceConfirmOpen(true);
      return;
    }
    saveTranscriptMutation.mutate();
  }, [event?.transcriptFilePath, saveTranscriptMutation]);

  const handleConfirmReplace = useCallback(() => {
    setIsReplaceConfirmOpen(false);
    saveTranscriptMutation.mutate();
  }, [saveTranscriptMutation]);

  const handleReplaceTranscript = useCallback(() => {
    setIsEditing(true);
    setTranscriptText("");
  }, []);

  const toggleContextFile = useCallback((path: string) => {
    setContextFiles(prev =>
      prev.map(file =>
        file.path === path ? { ...file, selected: !file.selected } : file
      )
    );
  }, []);

  const handleGenerateClinicalNotes = useCallback(() => {
    if (!selectedFilePath) {
      toast.error("Please select a transcript file first");
      return;
    }
    generateClinicalNotesMutation.mutate();
  }, [selectedFilePath, generateClinicalNotesMutation]);

  const handleGenerateComprehensive = useCallback(() => {
    if (!selectedFilePath) {
      toast.error("Please select a transcript file first");
      return;
    }
    generateComprehensiveMutation.mutate();
  }, [selectedFilePath, generateComprehensiveMutation]);

  const handleOpenDocx = useCallback(async () => {
    if (!generatedDocxPath) return;
    try {
      await invoke("plugin:opener|open_path", { path: generatedDocxPath });
    } catch (error) {
      toast.error("Failed to open document", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }, [generatedDocxPath]);

  const toggleStandardTask = useCallback((taskId: string) => {
    setStandardTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, selected: !task.selected } : task
      )
    );
  }, []);

  const removeCaseTask = useCallback((taskId: string) => {
    setCaseTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  const addCaseTask = useCallback((task: CaseTask) => {
    setCaseTasks(prev => [...prev, task]);
  }, []);

  const handleExtractTasks = useCallback(async () => {
    if (!selectedFilePath) {
      toast.error("Please select a transcript file first");
      return;
    }

    setIsExtractingTasks(true);

    try {
      const transcriptContent = await invoke<string>("read_text_file", { filePath: selectedFilePath });
      const clinicalNotes = event?.notes || "";

      const apiKey = await getAnthropicApiKey();
      if (!apiKey) {
        toast.error("Anthropic API key not configured", {
          description: "Please add your API key in Settings > API Keys"
        });
        return;
      }

      const modelConfig = await getAIModelConfig();

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

      try {
        const extractedTasks = JSON.parse(content);
        if (Array.isArray(extractedTasks)) {
          const tasksWithIds: CaseTask[] = extractedTasks.map((task: any, index: number) => {
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
  }, [selectedFilePath, event?.notes]);

  const handleCreateTasks = useCallback(() => {
    createTasksMutation.mutate();
  }, [createTasksMutation]);

  const handleResetTasks = useCallback(() => {
    setShowTaskOptions(true);
    setHasCreatedTasks(false);
    setStandardTasks(DEFAULT_STANDARD_TASKS);
    setCaseTasks([]);
  }, []);

  // ============================================================================
  // Derived values
  // ============================================================================

  const savedFileName = event?.transcriptFilePath
    ? event.transcriptFilePath.split('\\').pop() || event.transcriptFilePath.split('/').pop() || null
    : null;

  const showAISections = !isEditing && !!selectedFilePath;

  // ============================================================================
  // Render
  // ============================================================================

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
      <TranscriptSection
        isEditing={isEditing}
        transcriptText={transcriptText}
        onTranscriptTextChange={setTranscriptText}
        onSaveTranscript={handleSaveTranscript}
        onReplaceTranscript={handleReplaceTranscript}
        isSaving={saveTranscriptMutation.isPending}
        savedFileName={savedFileName}
        hasTranscriptFilePath={!!event?.transcriptFilePath}
        eventId={event?.eventId}
        clientFolderPath={clientFolderPath}
        txtFiles={txtFiles}
        selectedFilePath={selectedFilePath}
        onSelectedFilePathChange={setSelectedFilePath}
        isReplaceConfirmOpen={isReplaceConfirmOpen}
        onReplaceConfirmOpenChange={setIsReplaceConfirmOpen}
        onConfirmReplace={handleConfirmReplace}
      />

      {/* Clinical Notes Generation */}
      {showAISections && (
        <ClinicalNotesSection
          selectedFilePath={selectedFilePath}
          contextFiles={contextFiles}
          onToggleContextFile={toggleContextFile}
          hasPets={pets.length > 0}
          showOptions={showClinicalNotesOptions}
          onShowOptionsChange={setShowClinicalNotesOptions}
          hasGenerated={hasGeneratedNotes}
          isGenerating={generateClinicalNotesMutation.isPending}
          onGenerate={handleGenerateClinicalNotes}
        />
      )}

      {/* Comprehensive Clinical Notes (DOCX) */}
      {showAISections && (
        <ComprehensiveNotesSection
          selectedFilePath={selectedFilePath}
          contextFiles={contextFiles}
          onToggleContextFile={toggleContextFile}
          hasPets={pets.length > 0}
          clientFolderPath={clientFolderPath}
          showOptions={showComprehensiveOptions}
          onShowOptionsChange={setShowComprehensiveOptions}
          hasGenerated={hasGeneratedComprehensive}
          isGenerating={generateComprehensiveMutation.isPending}
          onGenerate={handleGenerateComprehensive}
          generatedDocxName={generatedDocxName}
          onOpenDocx={handleOpenDocx}
        />
      )}

      {/* Post-Consultation Tasks */}
      {showAISections && (
        <PostConsultationTasksSection
          eventId={event?.eventId}
          standardTasks={standardTasks}
          onToggleStandardTask={toggleStandardTask}
          caseTasks={caseTasks}
          onRemoveCaseTask={removeCaseTask}
          onAddCaseTask={addCaseTask}
          isExtractingTasks={isExtractingTasks}
          onExtractTasks={handleExtractTasks}
          showOptions={showTaskOptions}
          onShowOptionsChange={setShowTaskOptions}
          hasCreatedTasks={hasCreatedTasks}
          isCreating={createTasksMutation.isPending}
          onCreateTasks={handleCreateTasks}
          onResetTasks={handleResetTasks}
        />
      )}
    </div>
  );
}
