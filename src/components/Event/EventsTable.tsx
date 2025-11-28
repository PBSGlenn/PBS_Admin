// PBS Admin - Events Table Component
// Displays events for a client with add/edit/delete functionality

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent } from "../ui/dialog";
import { EventFormModal } from "./EventFormModal";
import { QuestionnaireReconciliation } from "../Client/QuestionnaireReconciliation";
import { getEventsByClientId, deleteEvent } from "@/lib/services/eventService";
import { getClientById } from "@/lib/services/clientService";
import type { Event, EventProcessingState } from "@/lib/types";
import { Plus, Edit, Trash2, FileCheck } from "lucide-react";
import { format } from "date-fns";

export interface EventsTableProps {
  clientId: number;
}

export function EventsTable({ clientId }: EventsTableProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [reconciliationEvent, setReconciliationEvent] = useState<Event | null>(null);
  const [questionnaireFilePath, setQuestionnaireFilePath] = useState<string>("");

  // Fetch events for this client
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", clientId],
    queryFn: () => getEventsByClientId(clientId),
  });

  // Fetch client to get folder path
  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientById(clientId),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      alert(`Failed to delete event: ${error}`);
    },
  });

  const handleDelete = (event: Event) => {
    if (window.confirm(`Are you sure you want to delete this ${event.eventType} event? This action cannot be undone.`)) {
      deleteMutation.mutate(event.eventId);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
  };

  const handleCloseEditDialog = () => {
    setEditingEvent(null);
  };

  // Check if event is a questionnaire event
  const isQuestionnaireEvent = (event: Event): boolean => {
    return event.eventType === "QuestionnaireReceived";
  };

  // Check if event is in progress (has processing state)
  const isEventInProgress = (event: Event): boolean => {
    if (!event.processingState) return false;
    try {
      const state = JSON.parse(event.processingState) as EventProcessingState;
      return state.status === 'draft' || state.status === 'in_progress';
    } catch {
      return false;
    }
  };

  // Extract submission ID from questionnaire event notes
  const extractSubmissionId = (notes: string): string | null => {
    const match = notes.match(/Submission ID:<\/strong>\s*([^<\s]+)/);
    return match ? match[1] : null;
  };

  // Handle opening questionnaire reconciliation
  const handleReviewQuestionnaire = async (event: Event) => {
    if (!client?.folderPath) {
      alert("Client folder not found. Cannot load questionnaire data.");
      return;
    }

    const submissionId = extractSubmissionId(event.notes || "");
    if (!submissionId) {
      alert("Could not extract submission ID from event notes.");
      return;
    }

    // Find the questionnaire JSON file
    try {
      const { findQuestionnaireFile } = await import('@/lib/services/questionnaireReconciliationService');
      const filePath = await findQuestionnaireFile(submissionId, client.folderPath);

      if (!filePath) {
        alert(`Could not find questionnaire file for submission ${submissionId}`);
        return;
      }

      setReconciliationEvent(event);
      setQuestionnaireFilePath(filePath);
    } catch (error) {
      console.error('Failed to find questionnaire file:', error);
      alert(`Error finding questionnaire file: ${error}`);
    }
  };

  const handleCloseReconciliation = () => {
    setReconciliationEvent(null);
    setQuestionnaireFilePath("");
  };

  const handleReconciliationComplete = () => {
    // Refresh client and events data
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    queryClient.invalidateQueries({ queryKey: ["events", clientId] });
    queryClient.invalidateQueries({ queryKey: ["pets"] });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy h:mm a");
    } catch {
      return "—";
    }
  };

  const stripHtml = (html: string) => {
    // Create a temporary DOM element to parse HTML
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const truncateNotes = (notes: string | null) => {
    if (!notes) return "—";
    // Strip HTML tags first, then truncate
    const plainText = stripHtml(notes);
    return plainText.length > 50 ? plainText.substring(0, 50) + "..." : plainText;
  };

  return (
    <>
      <Card>
        <CardHeader className="py-2 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Events</CardTitle>
              <CardDescription className="text-xs">
                {events.length} {events.length === 1 ? "event" : "events"} recorded
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Event
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {isLoading ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No events recorded yet. Click "Add Event" to get started.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] h-8 py-1.5">Type</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Date & Time</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Notes</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5 w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow
                      key={event.eventId}
                      className={`h-10 ${isEventInProgress(event) ? 'bg-amber-50 hover:bg-amber-100' : ''}`}
                    >
                      <TableCell className="text-[11px] font-medium py-1.5">
                        <div className="flex items-center gap-2">
                          <span>{event.eventType}</span>
                          {isEventInProgress(event) && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-800 border-amber-300">
                              In Progress
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] py-1.5">{formatDateTime(event.date)}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground py-1.5">
                        {truncateNotes(event.notes)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1">
                          {isQuestionnaireEvent(event) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReviewQuestionnaire(event)}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700"
                              title="Review Questionnaire"
                            >
                              <FileCheck className="h-3.5 w-3.5" />
                              <span className="sr-only">Review Questionnaire</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(event)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(event)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Event Modal */}
      <EventFormModal
        clientId={clientId}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />

      {/* Edit Event Modal */}
      <EventFormModal
        clientId={clientId}
        event={editingEvent}
        isOpen={!!editingEvent}
        onClose={handleCloseEditDialog}
      />

      {/* Questionnaire Reconciliation Dialog */}
      <Dialog open={!!reconciliationEvent} onOpenChange={(open) => !open && handleCloseReconciliation()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {reconciliationEvent && questionnaireFilePath && (
            <QuestionnaireReconciliation
              clientId={clientId}
              questionnaireFilePath={questionnaireFilePath}
              onClose={handleCloseReconciliation}
              onUpdateComplete={handleReconciliationComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
