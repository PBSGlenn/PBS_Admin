// PBS Admin - Event Form Component
// Form for creating/editing events

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RichTextEditor } from "../ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createEvent, updateEvent } from "@/lib/services/eventService";
import { onEventCreated, onEventUpdated } from "@/lib/automation/engine";
import { EVENT_TYPES } from "@/lib/types";
import type { Event, EventInput } from "@/lib/types";
import { Save, X } from "lucide-react";
import { format } from "date-fns";

export interface EventFormProps {
  clientId: number;
  event?: Event | null;
  onClose: () => void;
  onSave?: (event: Event) => void;
}

export function EventForm({ clientId, event, onClose, onSave }: EventFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!event;

  // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (dateString: string | undefined) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch {
      return "";
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    eventType: event?.eventType || "",
    date: formatDateTimeLocal(event?.date),
    notes: event?.notes || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Check if all required fields are valid
  const checkFormValidity = () => {
    const hasEventType = formData.eventType.trim().length > 0;
    const hasDate = formData.date.trim().length > 0;
    return hasEventType && hasDate;
  };

  // Update form validity whenever form data changes
  useEffect(() => {
    setIsFormValid(checkFormValidity());
  }, [formData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (input: EventInput) => {
      const savedEvent = await createEvent(input);
      // Trigger automation rules for event creation
      await onEventCreated(savedEvent);
      return savedEvent;
    },
    onSuccess: (savedEvent) => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] }); // Invalidate tasks too (automation may create tasks)
      if (onSave) onSave(savedEvent);
      onClose();
    },
    onError: (error) => {
      alert(`Failed to create event: ${error}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (input: Partial<EventInput>) => {
      const savedEvent = await updateEvent(event!.eventId, input);
      // Trigger automation rules for event update
      await onEventUpdated(savedEvent);
      return savedEvent;
    },
    onSuccess: (savedEvent) => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] }); // Invalidate tasks too (automation may create tasks)
      if (onSave) onSave(savedEvent);
      onClose();
    },
    onError: (error) => {
      alert(`Failed to update event: ${error}`);
    },
  });

  // Form validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.eventType.trim()) {
      newErrors.eventType = "Event type is required";
    }
    if (!formData.date.trim()) {
      newErrors.date = "Date and time is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Convert datetime-local format to ISO 8601
      const dateISO = new Date(formData.date).toISOString();

      const input: EventInput = {
        clientId,
        eventType: formData.eventType.trim() as any,
        date: dateISO,
        notes: formData.notes.trim() || undefined,
      };

      if (isEditing) {
        updateMutation.mutate(input);
      } else {
        createMutation.mutate(input);
      }
    }
  };

  // Handle field changes with real-time validation
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Real-time validation for the field being changed
    let fieldError = "";

    if (field === "eventType" && !value.trim()) {
      fieldError = "Event type is required";
    } else if (field === "date" && !value.trim()) {
      fieldError = "Date and time is required";
    }

    setErrors(prev => ({
      ...prev,
      [field]: fieldError
    }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        {/* Event Type */}
        <div className="space-y-2">
          <Label htmlFor="eventType" className="text-sm">
            Event Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.eventType}
            onValueChange={(value) => handleChange("eventType", value)}
          >
            <SelectTrigger className={`h-9 ${errors.eventType ? "border-destructive" : ""}`}>
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.eventType && (
            <p className="text-xs text-destructive">{errors.eventType}</p>
          )}
        </div>

        {/* Date and Time */}
        <div className="space-y-2">
          <Label htmlFor="date" className="text-sm">
            Date & Time <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            type="datetime-local"
            value={formData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className={`h-9 ${errors.date ? "border-destructive" : ""}`}
          />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date}</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm">Notes</Label>
          <RichTextEditor
            content={formData.notes}
            onChange={(content) => handleChange("notes", content)}
            placeholder="Additional information about this event..."
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          size="sm"
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isFormValid || isPending}
          size="sm"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Event" : "Create Event")}
        </Button>
      </div>
    </form>
  );
}
