// PBS Admin - Client History Dialog
// Lets the user select events from a client's record and export them as a
// patient-history DOCX (and optionally convert to PDF, then email). Operates
// per-Client (household) rather than per-Pet because Events are linked at the
// client level. Vet filtering is done manually in the selection table — there
// is no Pet→Vet or Event→Vet schema link.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { format } from "date-fns";
import {
  ClipboardList,
  FileText,
  FileType2,
  Loader2,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { EmailDraftDialog } from "../ui/email-draft-dialog";

import type { Client, Event, Pet } from "@/lib/types";
import { EVENT_TYPES } from "@/lib/types";
import { getEventsByClientId } from "@/lib/services/eventService";
import { getPetsByClientId } from "@/lib/services/petService";
import { getVetClinics, type VetClinic } from "@/lib/services/vetClinicsService";
import {
  generateHistoryDocx,
  generateHistoryPdf,
  type HistoryAudience,
} from "@/lib/services/clientHistoryService";
import { formatDate } from "@/lib/utils/dateUtils";
import { htmlToMarkdown } from "@/lib/utils/htmlToMarkdown";

export interface ClientHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  client: Client;
  clientFolderPath: string;
}

const AUDIENCE_OPTIONS: { value: HistoryAudience; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "vet", label: "Vet" },
  { value: "other", label: "Other" },
];

export function ClientHistoryDialog({
  open,
  onClose,
  client,
  clientFolderPath,
}: ClientHistoryDialogProps) {
  // Filters / settings
  const [audience, setAudience] = useState<HistoryAudience>("vet");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    () => new Set(EVENT_TYPES.filter((t) => t !== "Payment"))
  );

  // Per-event include/exclude — overrides type filter for individual rows the
  // user has manually toggled. Stored as a map of eventId → boolean (true =
  // include). Events not in the map follow the type filter.
  const [manualOverrides, setManualOverrides] = useState<Map<number, boolean>>(
    () => new Map()
  );

  // Addressee (vet/other) + cover note
  const [selectedVetId, setSelectedVetId] = useState<string>("");
  const [addresseeName, setAddresseeName] = useState<string>("");
  const [addresseeClinic, setAddresseeClinic] = useState<string>("");
  const [coverNote, setCoverNote] = useState<string>("");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [docxFilePath, setDocxFilePath] = useState<string>("");
  const [docxFileName, setDocxFileName] = useState<string>("");
  const [pdfFilePath, setPdfFilePath] = useState<string>("");
  const [pdfFileName, setPdfFileName] = useState<string>("");

  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Load events, pets, vet clinics
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", client.clientId],
    queryFn: () => getEventsByClientId(client.clientId),
    enabled: open,
  });

  const { data: pets = [] } = useQuery({
    queryKey: ["pets", client.clientId],
    queryFn: () => getPetsByClientId(client.clientId),
    enabled: open,
  });

  const { data: vetClinics = [] } = useQuery({
    queryKey: ["vetClinics"],
    queryFn: () => getVetClinics(),
    enabled: open,
  });

  // Reset state whenever the dialog reopens.
  useEffect(() => {
    if (open) {
      setAudience("vet");
      setDateFrom("");
      setDateTo("");
      setEnabledTypes(new Set(EVENT_TYPES.filter((t) => t !== "Payment")));
      setManualOverrides(new Map());
      setSelectedVetId("");
      setAddresseeName("");
      setAddresseeClinic("");
      setCoverNote("");
      setDocxFilePath("");
      setDocxFileName("");
      setPdfFilePath("");
      setPdfFileName("");
      setShowEmailDialog(false);
    }
  }, [open]);

  // When a vet is selected from the directory, auto-fill the addressee fields.
  useEffect(() => {
    if (!selectedVetId) return;
    const vet = vetClinics.find((v) => v.id === selectedVetId);
    if (vet) {
      setAddresseeName(vet.name);
      // VetClinic doesn't have a separate clinic field — `name` is typically
      // "Dr Smith at Foo Vet" or a clinic name. Leave clinic empty by default
      // so the user can fill it in if they want a separate line.
    }
  }, [selectedVetId, vetClinics]);

  // Sort events ascending for chronological output, but show in the table
  // descending (newest first) because that matches the rest of the app.
  const eventsByDateDesc = useMemo(() => {
    return [...events].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [events]);

  // Compute which events pass the type + date filters, then layer manual
  // overrides on top.
  const isEventIncluded = (event: Event): boolean => {
    if (manualOverrides.has(event.eventId)) {
      return manualOverrides.get(event.eventId) === true;
    }
    return passesAutoFilters(event);
  };

  const passesAutoFilters = (event: Event): boolean => {
    if (!enabledTypes.has(event.eventType)) return false;
    const eventDate = event.date.slice(0, 10); // YYYY-MM-DD
    if (dateFrom && eventDate < dateFrom) return false;
    if (dateTo && eventDate > dateTo) return false;
    return true;
  };

  const includedEvents = useMemo(
    () => eventsByDateDesc.filter(isEventIncluded),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventsByDateDesc, enabledTypes, dateFrom, dateTo, manualOverrides]
  );

  const toggleType = (type: string) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    // Clear manual overrides for all events of this type so the new filter
    // setting is what controls them.
    setManualOverrides((prev) => {
      const next = new Map(prev);
      for (const ev of events) {
        if (ev.eventType === type) next.delete(ev.eventId);
      }
      return next;
    });
  };

  const toggleEvent = (eventId: number, checked: boolean) => {
    setManualOverrides((prev) => {
      const next = new Map(prev);
      next.set(eventId, checked);
      return next;
    });
  };

  const selectAllVisible = () => {
    setManualOverrides((prev) => {
      const next = new Map(prev);
      for (const ev of eventsByDateDesc) next.set(ev.eventId, true);
      return next;
    });
  };

  const deselectAllVisible = () => {
    setManualOverrides((prev) => {
      const next = new Map(prev);
      for (const ev of eventsByDateDesc) next.set(ev.eventId, false);
      return next;
    });
  };

  const resetSelections = () => {
    setManualOverrides(new Map());
  };

  const handleGenerate = async () => {
    if (!clientFolderPath) {
      toast.error("Client folder is not set", {
        description: "Create or choose a client folder before exporting history.",
      });
      return;
    }
    if (includedEvents.length === 0) {
      toast.error("No events selected for export.");
      return;
    }

    setIsGenerating(true);
    try {
      // Generator expects events in chronological (oldest first) order.
      const orderedEvents = [...includedEvents].sort((a, b) =>
        a.date < b.date ? -1 : 1
      );

      const result = await generateHistoryDocx({
        client,
        pets: pets as Pet[],
        events: orderedEvents,
        audience,
        addressee: {
          name: addresseeName.trim() || undefined,
          clinic: addresseeClinic.trim() || undefined,
        },
        coverNote: coverNote.trim() || undefined,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        clientFolderPath,
      });

      if (!result.success || !result.filePath) {
        toast.error("Failed to generate history", {
          description: result.error,
        });
        return;
      }

      setDocxFilePath(result.filePath);
      setDocxFileName(result.fileName || "");
      setPdfFilePath("");
      setPdfFileName("");
      toast.success("Patient history generated", {
        description: result.fileName,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenDocx = async () => {
    if (!docxFilePath) return;
    try {
      await invoke("plugin:opener|open_path", {
        path: docxFilePath.replace(/\//g, "\\"),
      });
    } catch (error) {
      toast.error("Could not open document", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleOpenPdf = async () => {
    if (!pdfFilePath) return;
    try {
      await invoke("plugin:opener|open_path", {
        path: pdfFilePath.replace(/\//g, "\\"),
      });
    } catch (error) {
      toast.error("Could not open PDF", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleConvertPdf = async () => {
    if (!docxFilePath) return;
    setIsConvertingPdf(true);
    try {
      const result = await generateHistoryPdf({
        docxFilePath,
        clientFolderPath,
        clientSurname: client.lastName,
        audience,
      });
      if (!result.success || !result.filePath) {
        toast.error("Failed to convert to PDF", {
          description: result.error,
        });
        return;
      }
      setPdfFilePath(result.filePath);
      setPdfFileName(result.fileName || "");
      toast.success("Converted to PDF", {
        description: result.fileName,
      });
    } finally {
      setIsConvertingPdf(false);
    }
  };

  const recipientEmail = useMemo(() => {
    if (audience === "client") return client.email || "";
    if (audience === "vet") {
      const vet = vetClinics.find((v) => v.id === selectedVetId);
      return vet?.email || "";
    }
    return "";
  }, [audience, client.email, selectedVetId, vetClinics]);

  const emailSubject = useMemo(() => {
    const clientFullName = `${client.firstName} ${client.lastName}`.trim();
    const petList = pets
      .map((p) => p.name)
      .filter(Boolean)
      .join(", ");
    const subjectName = petList ? `${clientFullName} (${petList})` : clientFullName;
    return `Patient history — ${subjectName}`;
  }, [client.firstName, client.lastName, pets]);

  const emailBody = useMemo(() => {
    const greetingName =
      audience === "vet" && addresseeName ? addresseeName : client.firstName;
    const intro =
      audience === "vet"
        ? `Please find attached the patient history for ${client.firstName} ${client.lastName}.`
        : audience === "client"
          ? `As requested, please find attached your patient history.`
          : `Please find attached the patient history.`;
    return `Hi ${greetingName},\n\n${intro}\n\nKind regards,\nGlenn`;
  }, [audience, addresseeName, client.firstName, client.lastName]);

  const visibleSelectionCount = includedEvents.length;
  const totalEventCount = eventsByDateDesc.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Patient History — {client.firstName} {client.lastName}
          </DialogTitle>
          <DialogDescription>
            Select events to include and export as a DOCX (with the standard letterhead).
            Filtering by vet is manual — deselect any rows that aren't relevant for the recipient.
          </DialogDescription>
        </DialogHeader>

        {!clientFolderPath && (
          <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>
              No client folder is set. Create one from the client view before generating history.
            </div>
          </div>
        )}

        {/* Action band — pinned under the header so it's always visible once generated */}
        {docxFilePath && (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-2.5 text-[11px] text-emerald-900 space-y-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Generated: {docxFileName}
              {pdfFileName && <span className="text-emerald-700"> · PDF: {pdfFileName}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenDocx}
                className="h-7 text-[11px]"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open DOCX
              </Button>
              {!pdfFilePath && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleConvertPdf}
                  disabled={isConvertingPdf}
                  className="h-7 text-[11px]"
                >
                  {isConvertingPdf ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <FileType2 className="h-3 w-3 mr-1" />
                  )}
                  Convert to PDF
                </Button>
              )}
              {pdfFilePath && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPdf}
                    className="h-7 text-[11px]"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open PDF
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => setShowEmailDialog(true)}
                    className="h-7 text-[11px]"
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    Email…
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Filters & audience */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded border border-border p-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-[11px] w-20">Audience</Label>
                <Select
                  value={audience}
                  onValueChange={(v) => setAudience(v as HistoryAudience)}
                >
                  <SelectTrigger className="h-7 text-[11px] flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-[11px]"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-[11px] w-20">Date from</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-7 text-[11px] flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] w-20">Date to</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-7 text-[11px] flex-1"
                />
              </div>
            </div>

            {/* Audience-specific addressee block */}
            {audience !== "client" && (
              <div className="space-y-1.5">
                {audience === "vet" && vetClinics.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] w-20">From directory</Label>
                    <Select
                      value={selectedVetId || "__none__"}
                      onValueChange={(v) =>
                        setSelectedVetId(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px] flex-1">
                        <SelectValue placeholder="Pick a vet..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-[11px]">
                          (none)
                        </SelectItem>
                        {vetClinics.map((vet: VetClinic) => (
                          <SelectItem
                            key={vet.id}
                            value={vet.id}
                            className="text-[11px]"
                          >
                            {vet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20">Addressee</Label>
                  <Input
                    value={addresseeName}
                    onChange={(e) => setAddresseeName(e.target.value)}
                    placeholder={audience === "vet" ? "Dr Jane Smith" : "Recipient name"}
                    className="h-7 text-[11px] flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20">Clinic / Org</Label>
                  <Input
                    value={addresseeClinic}
                    onChange={(e) => setAddresseeClinic(e.target.value)}
                    placeholder="Optional second line"
                    className="h-7 text-[11px] flex-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Event type chips */}
          <div className="rounded border border-border p-2.5">
            <div className="text-[11px] font-medium mb-1.5">Event types</div>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map((type) => {
                const active = enabledTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cover note */}
          <div className="rounded border border-border p-2.5">
            <Label className="text-[11px] block mb-1">
              Cover note (optional — appears under the household block)
            </Label>
            <Textarea
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="e.g., Following our phone discussion, here's the relevant history…"
              rows={2}
              className="text-[11px]"
            />
          </div>

          {/* Event selection table */}
          <div className="rounded border border-border">
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border">
              <div className="text-[11px] font-medium">
                Events — {visibleSelectionCount} of {totalEventCount} included
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllVisible}
                  className="h-6 text-[10px]"
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllVisible}
                  className="h-6 text-[10px]"
                >
                  Deselect all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetSelections}
                  className="h-6 text-[10px]"
                >
                  Reset to filters
                </Button>
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {eventsLoading ? (
                <div className="p-3 text-center text-[11px] text-muted-foreground">
                  Loading events…
                </div>
              ) : eventsByDateDesc.length === 0 ? (
                <div className="p-3 text-center text-[11px] text-muted-foreground">
                  No events on file.
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1 w-8"></th>
                      <th className="px-2 py-1 w-24">Date</th>
                      <th className="px-2 py-1 w-32">Type</th>
                      <th className="px-2 py-1">Notes preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventsByDateDesc.map((event) => {
                      const included = isEventIncluded(event);
                      const preview = htmlToMarkdown(event.notes)
                        .replace(/\s+/g, " ")
                        .slice(0, 90);
                      return (
                        <tr
                          key={event.eventId}
                          className={`border-t border-border ${
                            included ? "" : "opacity-50"
                          }`}
                        >
                          <td className="px-2 py-1">
                            <Checkbox
                              checked={included}
                              onCheckedChange={(c) =>
                                toggleEvent(event.eventId, c === true)
                              }
                            />
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">
                            {formatDate(event.date, "d MMM yyyy")}
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">
                            {event.eventType}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">
                            {preview || <em>(no notes)</em>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 text-[11px]"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              !clientFolderPath ||
              includedEvents.length === 0
            }
            className="h-7 text-[11px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileText className="h-3 w-3 mr-1" />
                {docxFilePath ? "Regenerate DOCX" : "Generate DOCX"}
              </>
            )}
          </Button>
        </div>

        {/* Email draft dialog wired to the freshly-generated PDF */}
        {showEmailDialog && pdfFilePath && (
          <EmailDraftDialog
            isOpen={showEmailDialog}
            onClose={() => setShowEmailDialog(false)}
            initialTo={recipientEmail}
            initialSubject={emailSubject}
            initialBody={emailBody}
            clientName={`${client.firstName} ${client.lastName}`}
            attachments={[{ path: pdfFilePath, name: pdfFileName }]}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
