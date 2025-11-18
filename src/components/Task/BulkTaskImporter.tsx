// PBS Admin - Bulk Task Importer Component
// Import tasks from AI-generated JSON

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { createTask } from "@/lib/services/taskService";
import { calculateDueDate, isValidOffset } from "@/lib/utils/dateOffsetUtils";
import { Upload, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import type { TaskInput, TaskPriority } from "@/lib/types";

interface AITaskInput {
  description: string;
  dueDateOffset: string;
  priority: TaskPriority;
  context?: string;
}

interface PreviewTask {
  id: string; // Temporary ID for editing
  description: string;
  dueDate: string; // Calculated ISO date
  priority: TaskPriority;
  context?: string;
  dueDateOffset: string; // Original offset for display
}

export interface BulkTaskImporterProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  eventId: number;
  consultationDate: string;
  clientName: string;
}

export function BulkTaskImporter({
  isOpen,
  onClose,
  clientId,
  eventId,
  consultationDate,
  clientName
}: BulkTaskImporterProps) {
  const queryClient = useQueryClient();

  const [jsonInput, setJsonInput] = useState("");
  const [previewTasks, setPreviewTasks] = useState<PreviewTask[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setJsonInput("");
      setPreviewTasks([]);
      setParseError(null);
    }
  }, [isOpen]);

  // Parse JSON input
  const handleParseJSON = () => {
    setParseError(null);

    try {
      const parsed = JSON.parse(jsonInput);

      // Validate it's an array
      if (!Array.isArray(parsed)) {
        setParseError("JSON must be an array of tasks");
        return;
      }

      // Validate each task has required fields
      const invalidTasks = parsed.filter((task: any) =>
        !task.description || !task.dueDateOffset || !task.priority
      );

      if (invalidTasks.length > 0) {
        setParseError(`${invalidTasks.length} task(s) missing required fields (description, dueDateOffset, priority)`);
        return;
      }

      // Validate offset formats
      const invalidOffsets = parsed.filter((task: AITaskInput) =>
        !isValidOffset(task.dueDateOffset)
      );

      if (invalidOffsets.length > 0) {
        setParseError(`${invalidOffsets.length} task(s) have invalid dueDateOffset format`);
        return;
      }

      // Calculate due dates and create preview tasks
      const preview: PreviewTask[] = parsed.map((task: AITaskInput, index: number) => ({
        id: `preview-${index}`,
        description: task.description,
        dueDate: calculateDueDate(consultationDate, task.dueDateOffset),
        priority: task.priority,
        context: task.context,
        dueDateOffset: task.dueDateOffset
      }));

      setPreviewTasks(preview);
    } catch (error) {
      setParseError(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Auto-parse when user stops typing (debounced)
  useEffect(() => {
    if (!jsonInput.trim()) {
      setPreviewTasks([]);
      setParseError(null);
      return;
    }

    const timer = setTimeout(() => {
      handleParseJSON();
    }, 500);

    return () => clearTimeout(timer);
  }, [jsonInput]);

  // Update preview task
  const handleUpdateTask = (id: string, field: keyof PreviewTask, value: any) => {
    setPreviewTasks(prev => prev.map(task =>
      task.id === id ? { ...task, [field]: value } : task
    ));
  };

  // Remove preview task
  const handleRemoveTask = (id: string) => {
    setPreviewTasks(prev => prev.filter(task => task.id !== id));
  };

  // Import all tasks
  const handleImportTasks = async () => {
    if (previewTasks.length === 0) return;

    setIsCreating(true);

    try {
      // Create all tasks
      const taskPromises = previewTasks.map(task => {
        const input: TaskInput = {
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          status: "Pending",
          triggeredBy: "Consultation",
          automatedAction: "Manual",
          clientId,
          eventId
        };
        return createTask(input);
      });

      await Promise.all(taskPromises);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "dashboard"] }); // Refresh Dashboard tasks
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });

      // Close dialog
      onClose();
    } catch (error) {
      console.error("Failed to import tasks:", error);
      setParseError(`Failed to import tasks: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDisplayDate = (isoDate: string) => {
    try {
      return format(new Date(isoDate), "dd/MM/yyyy h:mm a");
    } catch {
      return isoDate;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tasks from AI</DialogTitle>
          <DialogDescription>
            Paste JSON output from AI task extraction and review before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Consultation Info */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-md text-xs">
            <div>
              <span className="text-muted-foreground">Client:</span>{" "}
              <span className="font-medium">{clientName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Consultation Date:</span>{" "}
              <span className="font-medium">{formatDisplayDate(consultationDate)}</span>
            </div>
          </div>

          {/* JSON Input */}
          <div className="space-y-1.5">
            <Label htmlFor="jsonInput" className="text-xs">
              Paste AI-Generated JSON
            </Label>
            <Textarea
              id="jsonInput"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`[\n  {\n    "description": "Email protocol to client",\n    "dueDateOffset": "3 days",\n    "priority": 1,\n    "context": "..."\n  }\n]`}
              className="font-mono text-[11px] min-h-[150px]"
            />
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-xs font-medium text-destructive">Parse Error</p>
                <p className="text-xs text-destructive/80 mt-1">{parseError}</p>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {previewTasks.length > 0 && !parseError && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Preview ({previewTasks.length} task{previewTasks.length !== 1 ? 's' : ''})
                </Label>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>Ready to import</span>
                </div>
              </div>

              <div className="rounded-md border max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] h-8 py-1.5 w-[40%]">Description</TableHead>
                      <TableHead className="text-[11px] h-8 py-1.5 w-[140px]">Due Date</TableHead>
                      <TableHead className="text-[11px] h-8 py-1.5 w-[80px]">Offset</TableHead>
                      <TableHead className="text-[11px] h-8 py-1.5 w-[70px]">Priority</TableHead>
                      <TableHead className="text-[11px] h-8 py-1.5 w-[60px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewTasks.map((task) => (
                      <TableRow key={task.id} className="h-10">
                        <TableCell className="text-[11px] py-1.5">
                          <Input
                            value={task.description}
                            onChange={(e) => handleUpdateTask(task.id, 'description', e.target.value)}
                            className="h-7 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5">
                          <span className="text-muted-foreground">
                            {formatDisplayDate(task.dueDate)}
                          </span>
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5">
                          <Input
                            value={task.dueDateOffset}
                            onChange={(e) => {
                              const newOffset = e.target.value;
                              // Update offset and recalculate due date
                              const newDueDate = isValidOffset(newOffset)
                                ? calculateDueDate(consultationDate, newOffset)
                                : task.dueDate; // Keep old date if invalid

                              setPreviewTasks(prev => prev.map(t =>
                                t.id === task.id
                                  ? { ...t, dueDateOffset: newOffset, dueDate: newDueDate }
                                  : t
                              ));
                            }}
                            placeholder="e.g., 3 days"
                            className="h-7 text-[11px] w-24"
                          />
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5">
                          <Input
                            type="number"
                            min="1"
                            max="5"
                            value={task.priority}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              // Constrain to valid TaskPriority range
                              if (value >= 1 && value <= 5) {
                                handleUpdateTask(task.id, 'priority', value as TaskPriority);
                              }
                            }}
                            className="h-7 text-[11px] w-16"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTask(task.id)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Context Display - for reference only */}
              {previewTasks.some(t => t.context) && (
                <div className="text-[10px] text-muted-foreground">
                  <p className="font-medium mb-1">Note: Task context is shown for reference (not saved with tasks)</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              size="sm"
              disabled={isCreating}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImportTasks}
              size="sm"
              disabled={previewTasks.length === 0 || isCreating || !!parseError}
              className="h-8 text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {isCreating ? "Importing..." : `Import ${previewTasks.length} Task${previewTasks.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
