// PBS Admin - Consultation Event Panel Component
// Right panel for Consultation event processing (transcript, reports, tasks)

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TranscriptInput } from "./TranscriptInput";
import { QuestionnaireSelector } from "./QuestionnaireSelector";
import { OutputSelector, type OutputType } from "./OutputSelector";
import type { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import type { EventProcessingState, OutputState } from "@/lib/types";
import { updateEvent, createEvent } from "@/lib/services/eventService";
import { createTask } from "@/lib/services/taskService";
import { getPetsByClientId } from "@/lib/services/petService";
import { readTranscriptFile } from "@/lib/services/transcriptFileService";
import { generateConsultationReports, type ReportGenerationParams } from "@/lib/services/multiReportGenerationService";
import { convertReportToDocxDirectly } from "@/lib/services/docxConversionService";
import { convertReportToPdf } from "@/lib/services/pdfConversionService";
import { Save, CheckCircle2, Loader2, FileText, Download } from "lucide-react";
import { addHours, format } from "date-fns";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";

export interface ConsultationEventPanelProps extends EventSpecificPanelProps {
  clientFolderPath?: string;
  clientName?: string;
  onClose?: () => void;
}

export function ConsultationEventPanel({
  clientId,
  event,
  formData,
  clientFolderPath,
  clientName,
  onSave,
  onClose,
  onProcessingStateChange
}: ConsultationEventPanelProps) {
  const queryClient = useQueryClient();

  // Track current event (either from props or from creation via onSave callback)
  const [currentEvent, setCurrentEvent] = useState(event);

  // Update currentEvent when event prop changes or when onSave is called
  useEffect(() => {
    if (event) {
      setCurrentEvent(event);
    }
  }, [event]);

  // Wrap onSave to update currentEvent when event is created
  const handleEventSave = (savedEvent: any) => {
    setCurrentEvent(savedEvent);
    if (onSave) {
      onSave(savedEvent);
    }
  };

  // Fetch pets for this client
  const { data: pets = [] } = useQuery({
    queryKey: ["pets", clientId],
    queryFn: () => getPetsByClientId(clientId),
    enabled: !!clientId
  });

  // Track selected transcript file path locally (for new events)
  const [selectedTranscriptPath, setSelectedTranscriptPath] = useState<string | null>(
    event?.transcriptFilePath || null
  );

  // Track selected questionnaire file path locally (for new events)
  const [selectedQuestionnairePath, setSelectedQuestionnairePath] = useState<string | null>(
    event?.questionnaireFilePath || null
  );

  // Track if prescription should be created as part of consultation
  const [createPrescription, setCreatePrescription] = useState(false);

  // Initialize processing state from event or create new
  const [processingState, setProcessingState] = useState<EventProcessingState>(() => {
    if (event?.processingState) {
      try {
        return JSON.parse(event.processingState) as EventProcessingState;
      } catch {
        // If parsing fails, create fresh state
        return createInitialState();
      }
    }
    return createInitialState();
  });

  // Create initial empty state
  function createInitialState(): EventProcessingState {
    return {
      status: 'draft',
      step: 'input_selection',
      transcriptSource: null,
      transcriptPasted: null,
      questionnaireSelected: false,
      selectedOutputs: ['clinicalNotes', 'clientReport'], // Default selections
      outputs: {},
      tasksCreated: false,
      incompleteTaskId: null
    };
  }

  // Notify parent when processing state changes
  useEffect(() => {
    if (onProcessingStateChange) {
      onProcessingStateChange(processingState);
    }
  }, [processingState, onProcessingStateChange]);

  // Auto-save file paths when event is created
  useEffect(() => {
    const saveFilePaths = async () => {
      if (currentEvent?.eventId && (selectedTranscriptPath || selectedQuestionnairePath)) {
        try {
          await updateEvent(currentEvent.eventId, {
            ...(selectedTranscriptPath && { transcriptFilePath: selectedTranscriptPath }),
            ...(selectedQuestionnairePath && { questionnaireFilePath: selectedQuestionnairePath })
          });
          queryClient.invalidateQueries({ queryKey: ["events", clientId] });
        } catch (error) {
          console.error('Failed to save file paths:', error);
        }
      }
    };

    saveFilePaths();
  }, [currentEvent?.eventId]); // Only run when eventId changes (event created)

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!currentEvent?.eventId) {
        throw new Error("Cannot save draft: Event not yet created");
      }

      // Update processing state to in_progress
      const updatedState: EventProcessingState = {
        ...processingState,
        status: 'in_progress'
      };

      // Save processing state and file paths to event
      await updateEvent(currentEvent.eventId, {
        processingState: JSON.stringify(updatedState),
        ...(selectedTranscriptPath && { transcriptFilePath: selectedTranscriptPath }),
        ...(selectedQuestionnairePath && { questionnaireFilePath: selectedQuestionnairePath })
      });

      // Create reminder task if not already created
      if (!updatedState.incompleteTaskId) {
        const dueDate = addHours(new Date(), 24).toISOString();
        const task = await createTask({
          clientId,
          eventId: currentEvent.eventId,
          description: `Complete Consultation processing for ${clientName || 'client'}`,
          dueDate,
          status: 'Pending',
          priority: 2,
          triggeredBy: 'Manual',
          automatedAction: 'CompleteEvent'
        });

        // Update state with task ID
        updatedState.incompleteTaskId = task.taskId;
        await updateEvent(currentEvent.eventId, {
          processingState: JSON.stringify(updatedState)
        });
      }

      return updatedState;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      if (onClose) onClose();
    },
    onError: (error) => {
      alert(`Failed to save draft: ${error}`);
    }
  });

  // Generate reports mutation
  const generateReportsMutation = useMutation({
    mutationFn: async () => {
      if (!currentEvent?.eventId) {
        throw new Error("Cannot generate reports: Event not yet created");
      }

      // Validate we have required data
      if (!pets || pets.length === 0) {
        throw new Error("No pet found for this client. Please add a pet first.");
      }

      // Get transcript text
      let transcriptText = "";
      if (processingState.transcriptSource === 'pasted') {
        transcriptText = processingState.transcriptPasted || "";
      } else if (processingState.transcriptSource === 'file' && selectedTranscriptPath) {
        const result = await readTranscriptFile(selectedTranscriptPath);
        if (!result.success) {
          throw new Error(result.error || "Failed to read transcript file");
        }
        transcriptText = result.content || "";
      }

      if (!transcriptText || transcriptText.trim().length < 100) {
        throw new Error("Transcript is required and must be at least 100 characters");
      }

      // Get questionnaire data if selected
      let questionnaireText: string | undefined;
      if (processingState.questionnaireSelected && selectedQuestionnairePath) {
        try {
          const { readTextFile } = await import("@tauri-apps/plugin-fs");
          questionnaireText = await readTextFile(selectedQuestionnairePath);
        } catch (error) {
          console.error("Failed to read questionnaire:", error);
          // Continue without questionnaire
        }
      }

      // Use first pet (TODO: Add pet selector if multiple pets)
      const pet = pets[0];
      const consultationDate = formData.date || format(new Date(), "yyyy-MM-dd");

      // Prepare report generation parameters
      const params: ReportGenerationParams = {
        clientName: clientName || "Client",
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed || undefined,
        petAge: pet.dateOfBirth ? undefined : undefined, // TODO: Calculate age
        petSex: pet.sex || undefined,
        consultationDate,
        transcript: transcriptText,
        questionnaire: questionnaireText
      };

      // Map output types to service options (Option A: 4-checkbox system)
      const selectedOutputs = processingState.selectedOutputs as OutputType[];
      const options = {
        generateComprehensive: selectedOutputs.includes('clinicalNotes'), // Clinical Notes → comprehensive-clinical (for Event.notes)
        generateAbridged: false, // Not using abridged notes anymore
        generateClient: selectedOutputs.includes('clientReport'), // Client Report → client-report template
        generatePractitioner: selectedOutputs.includes('practitionerReport'), // Practitioner Report → comprehensive-clinical (for folder)
        generateVet: selectedOutputs.includes('vetReport')
      };

      // Generate reports in parallel
      const results = await generateConsultationReports(params, options);

      // Update processing state with results
      const updatedOutputs: EventProcessingState['outputs'] = { ...processingState.outputs };

      if (results.comprehensiveReport) {
        updatedOutputs.clinicalNotes = {
          status: 'generated',
          content: results.comprehensiveReport.content,
          generatedAt: new Date().toISOString()
        };
      }

      if (results.clientReport) {
        updatedOutputs.clientReport = {
          status: 'generated',
          content: results.clientReport.content,
          generatedAt: new Date().toISOString()
        };
      }

      if (results.practitionerReport) {
        updatedOutputs.practitionerReport = {
          status: 'generated',
          content: results.practitionerReport.content,
          generatedAt: new Date().toISOString()
        };
      }

      if (results.vetReport) {
        updatedOutputs.vetReport = {
          status: 'generated',
          content: results.vetReport.content,
          generatedAt: new Date().toISOString()
        };
      }

      // Mark prescription as not started if selected but not implemented
      if (selectedOutputs.includes('prescription')) {
        updatedOutputs.prescription = {
          status: 'not_started',
          error: 'Prescription generation not yet implemented'
        };
      }

      const updatedState: EventProcessingState = {
        ...processingState,
        status: 'in_progress',
        step: 'reports_generated',
        outputs: updatedOutputs
      };

      // Save updated state and file paths to event
      await updateEvent(currentEvent.eventId, {
        processingState: JSON.stringify(updatedState),
        ...(selectedTranscriptPath && { transcriptFilePath: selectedTranscriptPath }),
        ...(selectedQuestionnairePath && { questionnaireFilePath: selectedQuestionnairePath })
      });

      // If comprehensive report generated, save to Event.notes (Option 1: Use high-quality comprehensive report)
      if (results.comprehensiveReport) {
        // Convert markdown to HTML for display in RichTextEditor
        const htmlNotes = await marked.parse(results.comprehensiveReport.content);

        const updatedEvent = await updateEvent(currentEvent.eventId, {
          notes: htmlNotes
        });
        // Update currentEvent with the saved notes
        setCurrentEvent(updatedEvent);
      }

      return { updatedState, results };
    },
    onSuccess: async ({ updatedState, results }) => {
      setProcessingState(updatedState);
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });

      // Automatically convert generated reports to DOCX
      const reportTypesToConvert: Array<'clientReport' | 'practitionerReport' | 'vetReport'> = [];

      if (results.comprehensiveReport) {
        reportTypesToConvert.push('clientReport');
      }
      if (results.practitionerReport) {
        reportTypesToConvert.push('practitionerReport');
      }
      if (results.vetReport) {
        reportTypesToConvert.push('vetReport');
      }

      // Convert each report to DOCX automatically
      for (const reportType of reportTypesToConvert) {
        try {
          await convertToDOCXMutation.mutateAsync(reportType);
        } catch (error) {
          console.error(`Failed to auto-convert ${reportType} to DOCX:`, error);
          // Continue with other conversions even if one fails
        }
      }

      // Create linked Prescription event if checkbox was checked
      if (createPrescription && currentEvent?.eventId) {
        try {
          const prescriptionEvent = await createEvent({
            clientId,
            eventType: 'Prescription',
            date: new Date().toISOString(),
            notes: '<p>Prescription for consultation on ' + format(new Date(formData.date || new Date()), 'dd/MM/yyyy') + '</p>',
            parentEventId: currentEvent.eventId
          });

          // Show success notification
          alert(`Prescription event created successfully! You can now edit it from the Events table.`);

          // Invalidate queries to refresh events table
          queryClient.invalidateQueries({ queryKey: ["events", clientId] });
        } catch (error) {
          console.error('Failed to create prescription event:', error);
          alert('Failed to create prescription event. You can create it manually from the Events table.');
        }
      }
    },
    onError: (error) => {
      alert(`Failed to generate reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Convert to DOCX mutation (direct conversion from memory, no intermediate markdown file)
  const convertToDOCXMutation = useMutation({
    mutationFn: async (reportType: 'clientReport' | 'practitionerReport' | 'vetReport') => {
      if (!currentEvent?.eventId || !clientFolderPath || !clientName) {
        throw new Error("Missing required data for conversion");
      }

      const output = processingState.outputs[reportType];
      if (!output || output.status !== 'generated') {
        throw new Error(`${reportType} not generated yet`);
      }

      const consultationDate = format(new Date(formData.date || new Date()), "yyyyMMdd");
      const clientSurname = clientName.split(' ').pop() || 'client';

      // Determine version (check for existing files - TODO: implement version checking)
      let version = 1;

      // Convert directly from markdown content to DOCX (skip intermediate .md file)
      const docxResult = await convertReportToDocxDirectly({
        markdownContent: output.content,
        clientId,
        clientSurname,
        consultationDate,
        reportType,
        version,
        clientFolderPath
      });

      if (!docxResult.success) {
        throw new Error(docxResult.error || "DOCX conversion failed");
      }

      // Update processing state
      const updatedOutputs = { ...processingState.outputs };
      updatedOutputs[reportType] = {
        ...output,
        status: 'saved',
        filePath: docxResult.docxFilePath,
        fileName: docxResult.docxFileName,
        version
      };

      const updatedState: EventProcessingState = {
        ...processingState,
        outputs: updatedOutputs
      };

      await updateEvent(currentEvent.eventId, {
        processingState: JSON.stringify(updatedState)
      });

      return { updatedState, docxResult, reportType };
    },
    onSuccess: async ({ updatedState, reportType }) => {
      setProcessingState(updatedState);
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });

      // Automatically convert client report to PDF after DOCX generation
      if (reportType === 'clientReport') {
        try {
          await convertToPDFMutation.mutateAsync();
        } catch (error) {
          console.error('Failed to auto-convert client report to PDF:', error);
          // Don't show alert here, just log - PDF conversion is optional
        }
      }
    },
    onError: (error) => {
      alert(`Failed to convert to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Convert to PDF mutation (for client report only)
  const convertToPDFMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId) {
        throw new Error("Event not created yet");
      }

      const output = processingState.outputs.clientReport;
      if (!output || output.status !== 'saved' || !output.filePath) {
        throw new Error("Client report must be converted to DOCX first");
      }

      // Convert DOCX to PDF using MS Word
      const pdfResult = await convertReportToPdf({
        docxFilePath: output.filePath,
        clientId,
        clientFolderPath: clientFolderPath || "",
        petName: pets[0]?.name || "Pet",
        consultationDate: event.date
      });

      if (!pdfResult.success) {
        throw new Error(pdfResult.error || "PDF conversion failed");
      }

      // Update processing state (status stays 'saved', just add PDF info)
      const updatedOutputs = { ...processingState.outputs };
      updatedOutputs.clientReport = {
        ...output,
        // Keep existing DOCX info, PDF conversion tracked in separate event
      };

      return { pdfResult };
    },
    onSuccess: ({ pdfResult }) => {
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      alert(`PDF created: ${pdfResult.pdfFileName}`);
    },
    onError: (error) => {
      alert(`Failed to convert to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Complete consultation mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId) {
        throw new Error("Event not created yet");
      }

      // Create follow-up tasks based on generated outputs
      const tasks: Array<{ description: string; priority: number; dueDate: string }> = [];

      // If client report saved, create task to email it
      if (processingState.outputs.clientReport?.status === 'saved') {
        tasks.push({
          description: `Email consultation report to ${clientName}`,
          priority: 1,
          dueDate: addHours(new Date(), 24).toISOString()
        });
      }

      // If vet report saved, create task to send to vet
      if (processingState.outputs.vetReport?.status === 'saved') {
        tasks.push({
          description: `Send vet report to primary care veterinarian`,
          priority: 2,
          dueDate: addHours(new Date(), 48).toISOString()
        });
      }

      // Create all follow-up tasks
      for (const taskData of tasks) {
        await createTask({
          clientId,
          eventId: currentEvent.eventId,
          description: taskData.description,
          dueDate: taskData.dueDate,
          status: 'Pending',
          priority: taskData.priority,
          triggeredBy: 'Consultation',
          automatedAction: 'Manual'
        });
      }

      // Mark reminder task as Done if it exists
      if (processingState.incompleteTaskId) {
        const { updateTask } = await import("@/lib/services/taskService");
        await updateTask(processingState.incompleteTaskId, {
          status: 'Done',
          completedOn: new Date().toISOString()
        });
      }

      // Update processing state to completed
      const updatedState: EventProcessingState = {
        ...processingState,
        status: 'completed',
        step: 'completed',
        tasksCreated: true
      };

      await updateEvent(currentEvent.eventId, {
        processingState: JSON.stringify(updatedState)
      });

      return { updatedState, tasksCreated: tasks.length };
    },
    onSuccess: ({ tasksCreated }) => {
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      alert(`Consultation processing complete! ${tasksCreated} follow-up task${tasksCreated !== 1 ? 's' : ''} created.`);
      if (onClose) onClose();
    },
    onError: (error) => {
      alert(`Failed to complete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  const handleSaveAsDraft = () => {
    saveDraftMutation.mutate();
  };

  const handleGenerate = () => {
    generateReportsMutation.mutate();
  };

  const handleConvertToDOCX = (reportType: 'clientReport' | 'vetReport') => {
    convertToDOCXMutation.mutate(reportType);
  };

  const handleConvertToPDF = () => {
    convertToPDFMutation.mutate();
  };

  const handleComplete = () => {
    completeMutation.mutate();
  };

  const isGenerateEnabled =
    (processingState.transcriptSource === 'file' || processingState.transcriptSource === 'pasted') &&
    processingState.selectedOutputs.length > 0;

  const isCompleteEnabled =
    processingState.selectedOutputs.every(outputType =>
      processingState.outputs[outputType]?.status === 'saved'
    );

  return (
    <div className="space-y-4">
      {/* Input Files Section */}
      <Card className="p-3">
        <h4 className="text-xs font-semibold mb-2">INPUT FILES</h4>
        <div className="space-y-3">
          {/* Transcript Input */}
          <TranscriptInput
            transcriptSource={processingState.transcriptSource}
            transcriptPasted={processingState.transcriptPasted}
            transcriptFilePath={selectedTranscriptPath}
            onSourceChange={(source) => {
              setProcessingState(prev => ({ ...prev, transcriptSource: source }));
            }}
            onPastedTextChange={(text) => {
              setProcessingState(prev => ({ ...prev, transcriptPasted: text }));
            }}
            onFileSelect={(filePath) => {
              // Store selected file path (will be saved when user clicks Save as Draft or Generate)
              setSelectedTranscriptPath(filePath);
            }}
          />

          {/* Questionnaire Selector */}
          <QuestionnaireSelector
            clientFolderPath={clientFolderPath}
            selectedPath={selectedQuestionnairePath}
            onSelect={(filePath) => {
              // Store selected file path (will be saved when user clicks Save as Draft or Generate)
              setSelectedQuestionnairePath(filePath);
              setProcessingState(prev => ({
                ...prev,
                questionnaireSelected: !!filePath
              }));
            }}
          />
        </div>
      </Card>

      {/* Outputs to Generate Section */}
      <Card className="p-3">
        <h4 className="text-xs font-semibold mb-2">OUTPUTS TO GENERATE</h4>
        <OutputSelector
          selectedOutputs={processingState.selectedOutputs as OutputType[]}
          onSelectionChange={(outputs) => {
            setProcessingState(prev => ({
              ...prev,
              selectedOutputs: outputs
            }));
          }}
        />

        <Separator className="my-3" />

        {/* Prescription Creation Option */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="createPrescription"
            checked={createPrescription}
            onCheckedChange={(checked) => setCreatePrescription(checked === true)}
          />
          <Label
            htmlFor="createPrescription"
            className="text-xs font-normal cursor-pointer"
          >
            Create linked Prescription event
          </Label>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 ml-6">
          Opens prescription form after consultation is saved
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Estimated cost: ~$0.25</span>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!isGenerateEnabled || generateReportsMutation.isPending}
            onClick={handleGenerate}
          >
            {generateReportsMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </Card>

      {/* Generated Outputs Section */}
      <Card className="p-3">
        <h4 className="text-xs font-semibold mb-2">GENERATED OUTPUTS</h4>
        {Object.keys(processingState.outputs).length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No outputs generated yet
          </div>
        ) : (
          <div className="space-y-2">
            {processingState.outputs.clinicalNotes && (
              <div className="p-2 bg-muted/50 rounded text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Clinical Notes (HTML)</div>
                    <div className="text-muted-foreground text-[10px]">
                      {processingState.outputs.clinicalNotes.status === 'generated' ? 'Saved to Event.notes - Visible in Events table' :
                       processingState.outputs.clinicalNotes.status === 'saved' ? 'Saved to Event.notes - Visible in Events table' :
                       processingState.outputs.clinicalNotes.error || 'Not started'}
                    </div>
                  </div>
                  <div className={`text-xs font-medium ${
                    processingState.outputs.clinicalNotes.status === 'generated' ? 'text-green-600' :
                    processingState.outputs.clinicalNotes.status === 'saved' ? 'text-green-600' :
                    processingState.outputs.clinicalNotes.error ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {processingState.outputs.clinicalNotes.status === 'generated' ? '✓ Saved to Event' :
                     processingState.outputs.clinicalNotes.status === 'saved' ? '✓ Saved to Event' :
                     processingState.outputs.clinicalNotes.error ? '✗ Error' : 'Pending'}
                  </div>
                </div>
                {currentEvent?.notes && processingState.outputs.clinicalNotes.status === 'generated' && (
                  <div className="text-[10px] text-green-600 font-medium">
                    ✓ Notes successfully saved and visible in Event record
                  </div>
                )}
              </div>
            )}
            {processingState.outputs.clientReport && (
              <div className="p-2 bg-muted/50 rounded text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Client Report (Markdown)</div>
                    <div className="text-muted-foreground text-[10px]">
                      {processingState.outputs.clientReport.status === 'generated' ? 'Ready for conversion to DOCX/PDF' :
                       processingState.outputs.clientReport.status === 'saved' ? `Saved: ${processingState.outputs.clientReport.fileName}` :
                       processingState.outputs.clientReport.error || 'Not started'}
                    </div>
                  </div>
                  <div className={`text-xs font-medium ${
                    processingState.outputs.clientReport.status === 'generated' ? 'text-green-600' :
                    processingState.outputs.clientReport.status === 'saved' ? 'text-green-600' :
                    processingState.outputs.clientReport.error ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {processingState.outputs.clientReport.status === 'generated' ? '✓ Generated' :
                     processingState.outputs.clientReport.status === 'saved' ? '✓ Saved' :
                     processingState.outputs.clientReport.error ? '✗ Error' : 'Pending'}
                  </div>
                </div>
                {processingState.outputs.clientReport.status === 'generated' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => handleConvertToDOCX('clientReport')}
                      disabled={convertToDOCXMutation.isPending}
                    >
                      {convertToDOCXMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <FileText className="h-3 w-3 mr-1" />
                          Save as DOCX
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {processingState.outputs.clientReport.status === 'saved' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={handleConvertToPDF}
                      disabled={convertToPDFMutation.isPending}
                    >
                      {convertToPDFMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-1" />
                          Convert to PDF
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {processingState.outputs.practitionerReport && (
              <div className="p-2 bg-muted/50 rounded text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Practitioner Report (Markdown)</div>
                    <div className="text-muted-foreground text-[10px]">
                      {processingState.outputs.practitionerReport.status === 'generated' ? 'Ready for conversion to DOCX/PDF' :
                       processingState.outputs.practitionerReport.status === 'saved' ? `Saved: ${processingState.outputs.practitionerReport.fileName}` :
                       processingState.outputs.practitionerReport.error || 'Not started'}
                    </div>
                  </div>
                  <div className={`text-xs font-medium ${
                    processingState.outputs.practitionerReport.status === 'generated' ? 'text-green-600' :
                    processingState.outputs.practitionerReport.status === 'saved' ? 'text-green-600' :
                    processingState.outputs.practitionerReport.error ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {processingState.outputs.practitionerReport.status === 'generated' ? '✓ Generated' :
                     processingState.outputs.practitionerReport.status === 'saved' ? '✓ Saved' :
                     processingState.outputs.practitionerReport.error ? '✗ Error' : 'Pending'}
                  </div>
                </div>
                {processingState.outputs.practitionerReport.status === 'generated' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => handleConvertToDOCX('practitionerReport')}
                      disabled={convertToDOCXMutation.isPending}
                    >
                      {convertToDOCXMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <FileText className="h-3 w-3 mr-1" />
                          Save as DOCX
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {processingState.outputs.practitionerReport.status === 'saved' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={handleConvertToPDF}
                      disabled={convertToPDFMutation.isPending}
                    >
                      {convertToPDFMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-1" />
                          Convert to PDF
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {processingState.outputs.vetReport && (
              <div className="p-2 bg-muted/50 rounded text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Vet Report (Markdown)</div>
                    <div className="text-muted-foreground text-[10px]">
                      {processingState.outputs.vetReport.status === 'generated' ? 'Ready for conversion to DOCX' :
                       processingState.outputs.vetReport.status === 'saved' ? `Saved: ${processingState.outputs.vetReport.fileName}` :
                       processingState.outputs.vetReport.error || 'Not started'}
                    </div>
                  </div>
                  <div className={`text-xs font-medium ${
                    processingState.outputs.vetReport.status === 'generated' ? 'text-green-600' :
                    processingState.outputs.vetReport.status === 'saved' ? 'text-green-600' :
                    processingState.outputs.vetReport.error ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {processingState.outputs.vetReport.status === 'generated' ? '✓ Generated' :
                     processingState.outputs.vetReport.status === 'saved' ? '✓ Saved' :
                     processingState.outputs.vetReport.error ? '✗ Error' : 'Pending'}
                  </div>
                </div>
                {processingState.outputs.vetReport.status === 'generated' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => handleConvertToDOCX('vetReport')}
                      disabled={convertToDOCXMutation.isPending}
                    >
                      {convertToDOCXMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <FileText className="h-3 w-3 mr-1" />
                          Save as DOCX
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {processingState.outputs.prescription && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                <div>
                  <div className="font-medium">Prescription</div>
                  <div className="text-muted-foreground text-[10px]">
                    {processingState.outputs.prescription.error || 'Not implemented yet'}
                  </div>
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Not available
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Tasks to Create Section */}
      <Card className="p-3">
        <h4 className="text-xs font-semibold mb-2">TASKS TO CREATE</h4>
        <p className="text-xs text-muted-foreground mb-2">
          (when you click Complete)
        </p>
        {processingState.tasksCreated ? (
          <div className="text-xs text-green-600 font-medium">
            ✓ Follow-up tasks already created
          </div>
        ) : (
          <div className="space-y-1">
            {processingState.outputs.clientReport?.status === 'saved' && (
              <div className="text-xs">
                • Email client report to {clientName}
              </div>
            )}
            {processingState.outputs.practitionerReport?.status === 'saved' && (
              <div className="text-xs">
                • Practitioner report saved to client folder
              </div>
            )}
            {processingState.outputs.vetReport?.status === 'saved' && (
              <div className="text-xs">
                • Send vet report to primary care veterinarian
              </div>
            )}
            {!processingState.outputs.clientReport?.status && !processingState.outputs.practitionerReport?.status && !processingState.outputs.vetReport?.status && (
              <div className="text-xs text-muted-foreground">
                No tasks to create yet (generate and save reports first)
              </div>
            )}
          </div>
        )}
      </Card>

      <Separator />

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSaveAsDraft}
          className="h-7 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />
          Save as Draft
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleComplete}
          disabled={!isCompleteEnabled || completeMutation.isPending}
          className="h-7 text-xs"
        >
          {completeMutation.isPending ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
