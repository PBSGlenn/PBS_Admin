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
import { Save, X, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export interface EventFormProps {
  clientId: number;
  event?: Event | null;
  onClose: () => void;
  onSave?: (event: Event) => void;
  hideNotes?: boolean;
  onFormDataChange?: (formData: { eventType: string, date: string, notes: string }) => void;
}

export function EventForm({
  clientId,
  event,
  onClose,
  onSave,
  hideNotes = false,
  onFormDataChange
}: EventFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!event;

  // Track newly created event
  const [createdEvent, setCreatedEvent] = useState<Event | null>(null);

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
    date: formatDateTimeLocal(event?.date) || format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: event?.notes || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Sync notes when event changes (e.g., when Clinical Notes are generated)
  useEffect(() => {
    if (event?.notes && event.notes !== formData.notes) {
      setFormData(prev => ({ ...prev, notes: event.notes || "" }));
    }
  }, [event?.notes]);

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

  // Notify parent of form data changes
  useEffect(() => {
    if (onFormDataChange) {
      onFormDataChange(formData);
    }
  }, [formData, onFormDataChange]);

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

      // Track created event and show success message
      setCreatedEvent(savedEvent);
      toast.success(`${formData.eventType} event created successfully`, {
        description: formData.eventType === 'Consultation' ? 'You can now generate reports' : undefined,
        duration: 3000
      });

      if (onSave) onSave(savedEvent);

      // Keep modal open for Consultation and Prescription events (user needs to generate documents)
      // Close modal for all other event types
      if (formData.eventType !== 'Consultation' && formData.eventType !== 'Prescription') {
        onClose();
      }
    },
    onError: (error) => {
      toast.error('Failed to create event', {
        description: error instanceof Error ? error.message : String(error)
      });
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

      // Show success message
      toast.success(`${formData.eventType} event updated successfully`);

      if (onSave) onSave(savedEvent);

      // Keep modal open for Consultation and Prescription events (user needs to generate documents)
      // Close modal for all other event types
      if (formData.eventType !== 'Consultation' && formData.eventType !== 'Prescription') {
        onClose();
      }
    },
    onError: (error) => {
      toast.error('Failed to update event', {
        description: error instanceof Error ? error.message : String(error)
      });
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3">
        {/* Event Type */}
        <div className="space-y-1.5">
          <Label htmlFor="eventType" className="text-xs">
            Event Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.eventType}
            onValueChange={(value) => handleChange("eventType", value)}
          >
            <SelectTrigger className={`h-8 text-xs ${errors.eventType ? "border-destructive" : ""}`}>
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map(type => (
                <SelectItem key={type} value={type} className="text-xs">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.eventType && (
            <p className="text-[10px] text-destructive">{errors.eventType}</p>
          )}
        </div>

        {/* Date and Time */}
        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs">
            Date & Time <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            type="datetime-local"
            value={formData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className={`h-8 text-xs ${errors.date ? "border-destructive" : ""}`}
          />
          {errors.date && (
            <p className="text-[10px] text-destructive">{errors.date}</p>
          )}
        </div>

        {/* Notes - Hidden when hideNotes is true (shown in event-specific panel) */}
        {!hideNotes && (
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Notes</Label>
            <RichTextEditor
              content={formData.notes}
              onChange={(content) => handleChange("notes", content)}
              placeholder="Additional information about this event..."
            />
          </div>
        )}
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
          {isPending ? (
            <>
              <Save className="h-3 w-3 mr-1" />
              {isEditing || createdEvent ? "Updating..." : "Creating..."}
            </>
          ) : createdEvent ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Event Created - Save Changes
            </>
          ) : (
            <>
              <Save className="h-3 w-3 mr-1" />
              {isEditing ? "Update Event" : "Create Event"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
