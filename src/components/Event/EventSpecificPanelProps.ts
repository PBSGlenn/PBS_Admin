// PBS Admin - Event-Specific Panel Props Interface
// Common props interface for event-specific panels (Consultation, Booking, etc.)

import type { Event } from "@/lib/types";

export interface EventSpecificPanelProps {
  clientId: number;
  event?: Event | null;
  formData: {
    eventType: string;
    date: string;
    notes: string;
  };
  onSave?: (event: Event) => void;
  onProcessingStateChange?: (processingState: any) => void;
}
