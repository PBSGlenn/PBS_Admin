// PBS Admin - Task Form Component
// Form for creating/editing tasks

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createTask, updateTask } from "@/lib/services/taskService";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/types";
import type { Task, TaskInput } from "@/lib/types";
import { TASK_TEMPLATES, getTemplateFormValues } from "@/lib/taskTemplates";
import { Save, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export interface TaskFormProps {
  clientId?: number;
  eventId?: number;
  task?: Task | null;
  onClose: () => void;
  onSave?: (task: Task) => void;
}

export function TaskForm({ clientId, eventId, task, onClose, onSave }: TaskFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!task;

  // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (dateString: string | undefined) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch {
      return "";
    }
  };

  // Task template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("general");

  // Form state
  const [formData, setFormData] = useState({
    description: task?.description || "",
    dueDate: formatDateTimeLocal(task?.dueDate),
    status: task?.status || "Pending",
    priority: task?.priority?.toString() || "3",
    automatedAction: task?.automatedAction || "",
    triggeredBy: task?.triggeredBy || "Manual",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Check if all required fields are valid
  const checkFormValidity = () => {
    const hasDescription = formData.description.trim().length > 0;
    const hasDueDate = formData.dueDate.trim().length > 0;
    const hasStatus = formData.status.trim().length > 0;
    const hasPriority = formData.priority.trim().length > 0;
    const hasTriggeredBy = formData.triggeredBy.trim().length > 0;
    return hasDescription && hasDueDate && hasStatus && hasPriority && hasTriggeredBy;
  };

  // Update form validity whenever form data changes
  useEffect(() => {
    setIsFormValid(checkFormValidity());
  }, [formData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (input: TaskInput) => createTask(input),
    onSuccess: (savedTask) => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["client", clientId] });
        queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      }
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", "event", eventId] });
      }
      if (onSave) onSave(savedTask);
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to create task", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (input: Partial<TaskInput>) => updateTask(task!.taskId, input),
    onSuccess: (savedTask) => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["client", clientId] });
        queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      }
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", "event", eventId] });
      }
      if (onSave) onSave(savedTask);
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to update task", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Form validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }
    if (!formData.dueDate.trim()) {
      newErrors.dueDate = "Due date is required";
    }
    if (!formData.status.trim()) {
      newErrors.status = "Status is required";
    }
    if (!formData.priority.trim()) {
      newErrors.priority = "Priority is required";
    }
    if (!formData.triggeredBy.trim()) {
      newErrors.triggeredBy = "Triggered by is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Convert datetime-local format to ISO 8601
      const dueDateISO = new Date(formData.dueDate).toISOString();

      const input: TaskInput = {
        clientId: clientId || undefined,
        eventId: eventId || undefined,
        description: formData.description.trim(),
        dueDate: dueDateISO,
        status: formData.status.trim() as any,
        priority: parseInt(formData.priority) as any,
        automatedAction: formData.automatedAction.trim() || undefined,
        triggeredBy: formData.triggeredBy.trim(),
      };

      if (isEditing) {
        updateMutation.mutate(input);
      } else {
        createMutation.mutate(input);
      }
    }
  };

  // Handle task template selection
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);

    // Only auto-populate if NOT editing an existing task
    if (!isEditing) {
      const templateValues = getTemplateFormValues(templateId);
      setFormData(templateValues);
      // Clear any validation errors when template changes
      setErrors({});
    }
  };

  // Handle field changes with real-time validation
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Real-time validation for the field being changed
    let fieldError = "";

    if (field === "description" && !value.trim()) {
      fieldError = "Description is required";
    } else if (field === "dueDate" && !value.trim()) {
      fieldError = "Due date is required";
    } else if (field === "status" && !value.trim()) {
      fieldError = "Status is required";
    } else if (field === "priority" && !value.trim()) {
      fieldError = "Priority is required";
    } else if (field === "triggeredBy" && !value.trim()) {
      fieldError = "Triggered by is required";
    }

    setErrors(prev => ({
      ...prev,
      [field]: fieldError
    }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3">
        {/* Task Type Selection (only show when creating new task) */}
        {!isEditing && (
          <div className="space-y-1.5">
            <Label htmlFor="taskType" className="text-xs">
              Task Type
            </Label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TEMPLATES.map(template => (
                  <SelectItem key={template.id} value={template.id} className="text-xs">
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate !== 'general' && (
              <p className="text-[10px] text-muted-foreground">
                {TASK_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs">
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={3}
            placeholder="What needs to be done?"
            className={`text-xs min-h-[60px] ${errors.description ? "border-destructive" : ""}`}
          />
          {errors.description && (
            <p className="text-[10px] text-destructive">{errors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Due Date */}
          <div className="space-y-1.5">
            <Label htmlFor="dueDate" className="text-xs">
              Due Date & Time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={formData.dueDate}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              className={`h-8 text-xs ${errors.dueDate ? "border-destructive" : ""}`}
            />
            {errors.dueDate && (
              <p className="text-[10px] text-destructive">{errors.dueDate}</p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="priority" className="text-xs">
              Priority <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => handleChange("priority", value)}
            >
              <SelectTrigger className={`h-8 text-xs ${errors.priority ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map(priority => (
                  <SelectItem key={priority} value={priority.toString()} className="text-xs">
                    {priority} {priority === 1 ? "(Highest)" : priority === 5 ? "(Lowest)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-[10px] text-destructive">{errors.priority}</p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs">
            Status <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleChange("status", value)}
          >
            <SelectTrigger className={`h-8 text-xs ${errors.status ? "border-destructive" : ""}`}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map(status => (
                <SelectItem key={status} value={status} className="text-xs">
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="text-[10px] text-destructive">{errors.status}</p>
          )}
        </div>

        {/* Triggered By */}
        <div className="space-y-1.5">
          <Label htmlFor="triggeredBy" className="text-xs">
            Triggered By <span className="text-destructive">*</span>
          </Label>
          <Input
            id="triggeredBy"
            value={formData.triggeredBy}
            onChange={(e) => handleChange("triggeredBy", e.target.value)}
            placeholder="e.g., Manual, Event:Booking, Schedule"
            className={`h-8 text-xs ${errors.triggeredBy ? "border-destructive" : ""}`}
          />
          {errors.triggeredBy && (
            <p className="text-[10px] text-destructive">{errors.triggeredBy}</p>
          )}
        </div>

        {/* Automated Action (Optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="automatedAction" className="text-xs">Automated Action</Label>
          <Input
            id="automatedAction"
            value={formData.automatedAction}
            onChange={(e) => handleChange("automatedAction", e.target.value)}
            placeholder="e.g., CheckQuestionnaireReturned"
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-muted-foreground">Optional: Label of automation that will/did run</p>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-1.5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          size="sm"
          disabled={isPending}
          className="h-7 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isFormValid || isPending}
          size="sm"
          className="h-7 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />
          {isPending ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Task" : "Create Task")}
        </Button>
      </div>
    </form>
  );
}
