// PBS Admin - Event Form Modal Component
// Two-panel modal layout: standard event fields (left) + event-specific panel (right)

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventForm } from "./EventForm";
import { ConsultationEventPanel } from "./ConsultationEventPanel";
import { getClientById } from "@/lib/services/clientService";
import type { Event } from "@/lib/types";

export interface EventFormModalProps {
  clientId: number;
  event?: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (event: Event) => void;
}

export function EventFormModal({
  clientId,
  event,
  isOpen,
  onClose,
  onSave
}: EventFormModalProps) {
  const isEditing = !!event;

  // Fetch client data to get folder path
  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientById(clientId),
    enabled: isOpen // Only fetch when modal is open
  });

  // Track current event (either initial event or newly created event)
  const [currentEvent, setCurrentEvent] = useState<Event | null>(event || null);

  // Sync currentEvent when event prop changes
  useEffect(() => {
    if (event) {
      setCurrentEvent(event);
    }
  }, [event]);

  // Track current form data to update right panel
  const [formData, setFormData] = useState({
    eventType: event?.eventType || "",
    date: "",
    notes: ""
  });

  const eventType = formData.eventType || null;

  // Handle event save - update currentEvent and notify parent
  const handleEventSave = (savedEvent: Event) => {
    setCurrentEvent(savedEvent);
    if (onSave) {
      onSave(savedEvent);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEditing ? "Edit Event" : "Create Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel - Standard Event Fields */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Event Details
            </h3>
            <EventForm
              clientId={clientId}
              event={currentEvent}
              onClose={onClose}
              onSave={handleEventSave}
              onFormDataChange={setFormData}
            />
          </div>

          {/* Right Panel - Event-Specific Controls */}
          <div className="space-y-3 border-l pl-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {eventType === "Consultation" ? "Consultation Processing" : "Event-Specific Options"}
            </h3>

            {/* Conditional Event-Specific Panels */}
            {eventType === "Consultation" ? (
              <ConsultationEventPanel
                clientId={clientId}
                event={currentEvent}
                formData={formData}
                clientFolderPath={client?.folderPath ?? undefined}
                clientName={client ? `${client.firstName} ${client.lastName}` : undefined}
                onSave={handleEventSave}
                onClose={onClose}
              />
            ) : (
              <div className="text-xs text-muted-foreground">
                No additional options for this event type
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
