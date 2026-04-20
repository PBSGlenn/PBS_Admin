import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import { BEHAVIOR_MEDICATIONS, Medication, getMedicationById, FREQUENCY_OPTIONS } from "@/lib/medications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { updateEvent } from "@/lib/services/eventService";
import { getPetsByClientId } from "@/lib/services/petService";
import { getClientById } from "@/lib/services/clientService";
import { format } from "date-fns";
import { getPrescriptionTemplate, processPrescriptionTemplate } from "@/lib/prescriptionTemplates";

const CUSTOM_MEDICATION_ID = '__custom__';

function buildCustomMedication(genericName: string, scheduleClass: string): Medication {
  return {
    id: CUSTOM_MEDICATION_ID,
    genericName,
    brandNames: [],
    category: 'Other',
    species: ['Both'],
    doseRange: { min: 0, max: 0, unit: 'mg/kg' },
    frequencyOptions: FREQUENCY_OPTIONS.map(f => f.label),
    defaultFrequency: 'Twice daily',
    description: 'Custom medication entered for this prescription.',
    indications: [],
    sideEffects: [],
    contraindications: [],
    notes: '',
    scheduleClass: scheduleClass || undefined,
  };
}

interface PrescriptionData {
  petId: string;
  petName: string;
  petSpecies: string;
  medicationId: string;
  formulation: string; // e.g., "Tablet", "Capsule", "Liquid"
  doseConcentration: string; // e.g., "20mg per tablet", "2mg/ml"
  amountToDispense: string; // e.g., "28" (total quantity to dispense)
  doseRate: string; // e.g., "1" (tablet), "5" (ml), "0.5" (tablet)
  frequency: string; // e.g., "twice_daily"
  repeats: string; // e.g., "5"
  specialInstructions: string;
  petWeight?: string; // Optional: for dose calculations
  useCustomDirections: boolean; // When true, use customDirections as free text on prescription
  customDirections: string; // Free-text dosage & administration directions
}

export function PrescriptionEventPanel({
  clientId,
  event,
  formData,
  clientFolderPath,
  clientName,
  onSave,
  onClose,
}: EventSpecificPanelProps) {
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [prescriptionData, setPrescriptionData] = useState<PrescriptionData>({
    petId: '',
    petName: '',
    petSpecies: '',
    medicationId: '',
    formulation: 'Tablet',
    doseConcentration: '',
    amountToDispense: '',
    doseRate: '',
    frequency: 'twice_daily',
    repeats: '5',
    specialInstructions: '',
    petWeight: '',
    useCustomDirections: false,
    customDirections: '',
  });
  const [customGenericName, setCustomGenericName] = useState<string>('');
  const [customScheduleClass, setCustomScheduleClass] = useState<string>('');
  const [docxFilePath, setDocxFilePath] = useState<string>('');
  const [pdfFilePath, setPdfFilePath] = useState<string>('');

  const isCustomMedication = prescriptionData.medicationId === CUSTOM_MEDICATION_ID;
  const queryClient = useQueryClient();

  // Fetch client data
  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientById(clientId),
  });

  // Fetch client's pets
  const { data: pets = [], isLoading: petsLoading } = useQuery({
    queryKey: ["pets", clientId],
    queryFn: () => getPetsByClientId(clientId),
  });

  // Handle pet selection
  const handlePetChange = (petId: string) => {
    const selectedPet = pets.find(p => p.petId.toString() === petId);
    if (selectedPet) {
      setPrescriptionData(prev => ({
        ...prev,
        petId,
        petName: selectedPet.name,
        petSpecies: selectedPet.species,
      }));
    }
  };

  // Handle medication selection
  const handleMedicationChange = (medicationId: string) => {
    if (medicationId === CUSTOM_MEDICATION_ID) {
      const custom = buildCustomMedication(customGenericName, customScheduleClass);
      setSelectedMedication(custom);
      setPrescriptionData(prev => ({
        ...prev,
        medicationId: CUSTOM_MEDICATION_ID,
        frequency: 'twice_daily',
      }));
      return;
    }
    const medication = getMedicationById(medicationId);
    setSelectedMedication(medication || null);
    setPrescriptionData(prev => ({
      ...prev,
      medicationId,
      frequency: medication?.defaultFrequency.toLowerCase().replace(/ /g, '_') || 'twice_daily',
    }));
  };

  // Keep the synthetic custom medication in sync with the custom input fields
  const handleCustomGenericNameChange = (value: string) => {
    setCustomGenericName(value);
    if (isCustomMedication) {
      setSelectedMedication(buildCustomMedication(value, customScheduleClass));
    }
  };

  const handleCustomScheduleChange = (value: string) => {
    setCustomScheduleClass(value);
    if (isCustomMedication) {
      setSelectedMedication(buildCustomMedication(customGenericName, value));
    }
  };

  // Calculate suggested dose based on weight
  const calculateSuggestedDose = (): string => {
    if (!selectedMedication || !prescriptionData.petWeight) return '';
    const weight = parseFloat(prescriptionData.petWeight);
    if (isNaN(weight) || weight <= 0) return '';

    const { min, max, unit } = selectedMedication.doseRange;
    if (unit === 'mg/kg') {
      const minDose = (weight * min).toFixed(1);
      const maxDose = (weight * max).toFixed(1);
      return `${minDose} - ${maxDose} mg`;
    } else {
      return `${min} - ${max} ${unit}`;
    }
  };

  // Generate DOCX mutation
  const generateDOCXMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventId || !clientFolderPath || !clientName || !selectedMedication) {
        throw new Error("Missing required data for prescription generation");
      }

      if (!selectedMedication.genericName.trim()) {
        throw new Error("Please enter a Generic Name for the custom medication");
      }

      // Load prescription template
      const template = await getPrescriptionTemplate();

      // Prepare template variables
      const frequencyLabel = FREQUENCY_OPTIONS.find(f => f.value === prescriptionData.frequency)?.label || prescriptionData.frequency;
      const selectedPet = pets.find(p => p.petId.toString() === prescriptionData.petId);

      // Build client address (multi-line format with Pandoc markdown line breaks)
      const addressLines = [];
      if (client?.streetAddress) addressLines.push(`${client.streetAddress},`);
      if (client?.city) addressLines.push(`${client.city},`);

      // State and postcode on same line without trailing comma
      const lastLine = [client?.state, client?.postcode].filter(Boolean).join(' ');
      if (lastLine) addressLines.push(lastLine);

      // Use two spaces + newline for Pandoc hard line breaks
      const clientAddress = addressLines.join('  \n');

      // Build dosage directions (free text when custom, otherwise compose from structured fields)
      const dosageDirections = prescriptionData.useCustomDirections
        ? prescriptionData.customDirections.trim()
        : `${prescriptionData.doseRate} ${prescriptionData.formulation.toLowerCase()} ${frequencyLabel.toLowerCase()}`;

      if (!dosageDirections) {
        throw new Error("Please enter dosage and administration directions");
      }

      // Combine dose concentration with formulation type (e.g. "5mg per tablet" + "Tablet" → "5mg tablet")
      const formulationDisplay = (() => {
        const conc = prescriptionData.doseConcentration.trim();
        const formType = prescriptionData.formulation;
        if (!conc) return formType;
        // "5mg per tablet" → strip " per tablet" to get just the strength
        const strength = conc.replace(/\s*per\s+\S+\s*$/i, '').trim();
        // If the stripped strength already describes the form (e.g. "2mg/ml"), append form type
        // Otherwise append form type as lowercase (e.g. "5mg" + "Tablet" → "5mg tablet")
        return `${strength} ${formType.toLowerCase()}`;
      })();

      // Prepare simple prescription summary for Event notes
      const prescriptionSummary = `Drug name: ${selectedMedication.genericName}
Formulation: ${formulationDisplay}
Dosage and directions: ${dosageDirections}
FOR ANIMAL TREATMENT ONLY
Quantity: ${prescriptionData.amountToDispense}
Number of repeats: ${prescriptionData.repeats}${prescriptionData.specialInstructions ? `\nSpecial instructions: ${prescriptionData.specialInstructions}` : ''}`;

      // Extract client surname
      const clientSurname = clientName.split(' ').pop() || clientName;

      const templateData = {
        prescription_date: format(new Date(), "dd/MM/yyyy"),
        pet_name: prescriptionData.petName || "Pet",
        client_surname: clientSurname,
        pet_breed: selectedPet?.breed || "Unknown breed",
        client_name: clientName,
        client_address: clientAddress,
        medication_name: selectedMedication.genericName,
        formulation: formulationDisplay,
        dosage_directions: dosageDirections,
        amount_to_dispense: prescriptionData.amountToDispense,
        repeats: prescriptionData.repeats,
        special_instructions: prescriptionData.specialInstructions,
      };

      // Process template with variables
      const processedMarkdown = processPrescriptionTemplate(template.template, templateData);

      // Generate filename
      const consultationDate = format(new Date(formData.date || new Date()), "yyyyMMdd");
      const medicationSlug = selectedMedication.genericName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '');
      const docxFileName = `${clientSurname.toLowerCase()}_${consultationDate}_prescription_${medicationSlug}.docx`;
      const docxFilePath = `${clientFolderPath}\\${docxFileName}`;

      // Call Tauri command to generate DOCX from processed template
      await invoke<string>("generate_prescription_docx", {
        templateContent: processedMarkdown,
        outputPath: docxFilePath,
      });

      // Update event with prescription details
      const updatedEvent = await updateEvent(event.eventId, {
        notes: prescriptionSummary,
      });

      return { docxFilePath, docxFileName, updatedEvent };
    },
    onSuccess: async ({ docxFilePath, updatedEvent }) => {
      setDocxFilePath(docxFilePath);

      // Notify parent of updated event (this updates currentEvent in EventFormModal)
      // which propagates to EventForm to sync the notes display
      if (onSave && updatedEvent) {
        onSave(updatedEvent);
      }

      // Invalidate event query to refresh notes display in tables
      queryClient.invalidateQueries({ queryKey: ["events", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });

      // Show success toast
      toast.success("Prescription generated", {
        description: "DOCX file created and event notes updated"
      });

      // Open DOCX file for veterinarian review
      try {
        await invoke("plugin:opener|open_path", { path: docxFilePath });
      } catch (error) {
        console.error("Failed to open DOCX file:", error);
        toast.error("Failed to open DOCX file", {
          description: "Please open manually from the client folder"
        });
      }
    },
    onError: (error) => {
      console.error("DOCX generation failed:", error);
      toast.error("Failed to generate prescription", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    },
  });

  // Convert to PDF mutation
  const convertToPDFMutation = useMutation({
    mutationFn: async () => {
      if (!docxFilePath) {
        throw new Error("DOCX file not generated yet");
      }

      const pdfFilePath = docxFilePath.replace('.docx', '.pdf');

      // Call Tauri command for DOCX to PDF conversion
      await invoke<string>("convert_docx_to_pdf", {
        docxPath: docxFilePath,
        pdfPath: pdfFilePath,
      });

      return pdfFilePath;
    },
    onSuccess: (pdfPath) => {
      setPdfFilePath(pdfPath);
    },
    onError: (error) => {
      console.error("PDF conversion failed:", error);
    },
  });

  // Generate prescription text content
  const generatePrescriptionText = (): string => {
    if (!selectedMedication) return '';

    const frequencyLabel = FREQUENCY_OPTIONS.find(f => f.value === prescriptionData.frequency)?.label || prescriptionData.frequency;

    return `<h2>Prescription</h2>
<p><strong>Medication:</strong> ${selectedMedication.genericName} (${selectedMedication.brandNames.join(', ')})</p>
<p><strong>Category:</strong> ${selectedMedication.category}</p>
<p><strong>Schedule:</strong> ${selectedMedication.scheduleClass || 'N/A'}</p>
<p><strong>Formulation:</strong> ${prescriptionData.formulation}</p>
<p><strong>Dose Concentration:</strong> ${prescriptionData.doseConcentration}</p>
<p><strong>Amount to Dispense:</strong> ${prescriptionData.amountToDispense}</p>

<h3>Dosing</h3>
<p><strong>Dose Rate:</strong> ${prescriptionData.doseRate}</p>
<p><strong>Frequency:</strong> ${frequencyLabel}</p>
<p><strong>Repeats:</strong> ${prescriptionData.repeats}</p>
${prescriptionData.petWeight ? `<p><strong>Pet Weight:</strong> ${prescriptionData.petWeight} kg</p>` : ''}

<h3>Indications</h3>
<ul>
${selectedMedication.indications.map(indication => `<li>${indication}</li>`).join('\n')}
</ul>

<h3>Common Side Effects</h3>
<ul>
${selectedMedication.sideEffects.map(effect => `<li>${effect}</li>`).join('\n')}
</ul>

${prescriptionData.specialInstructions ? `<h3>Special Instructions</h3><p>${prescriptionData.specialInstructions}</p>` : ''}

<h3>Important Notes</h3>
<p>${selectedMedication.notes}</p>`;
  };

  return (
    <div className="space-y-3 text-[11px]">
      <div className="space-y-2">
        {/* Client Name Display */}
        <div className="pb-2 border-b">
          <p className="text-[10px] text-muted-foreground">Client</p>
          <p className="font-semibold text-xs">{clientName}</p>
        </div>

        {/* Folder Warning - Show at top if folder not created */}
        {!clientFolderPath && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
            <p className="text-[10px] text-amber-600">
              ⚠ Client folder not created - please create folder first
            </p>
          </div>
        )}

        <h3 className="font-semibold text-xs">Prescription Details</h3>

        {/* Pet Selection */}
        <div className="space-y-1">
          <Label className="text-[10px]">Select Pet</Label>
          <Select
            value={prescriptionData.petId}
            onValueChange={handlePetChange}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder={petsLoading ? "Loading pets..." : "Choose pet..."} />
            </SelectTrigger>
            <SelectContent>
              {pets.map((pet) => (
                <SelectItem key={pet.petId} value={pet.petId.toString()} className="text-[11px]">
                  {pet.name} ({pet.species}{pet.breed ? `, ${pet.breed}` : ''})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Medication Selection */}
        <div className="space-y-1">
          <Label className="text-[10px]">Select Medication</Label>
          <Select
            value={prescriptionData.medicationId}
            onValueChange={handleMedicationChange}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="Choose medication..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM_MEDICATION_ID} className="text-[11px] italic">
                ✏ Custom medication...
              </SelectItem>
              <SelectSeparator />
              {[...BEHAVIOR_MEDICATIONS]
                .sort((a, b) => a.genericName.localeCompare(b.genericName))
                .map((med) => (
                  <SelectItem key={med.id} value={med.id} className="text-[11px]">
                    {med.genericName} ({med.category})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Show medication info and prescription controls only after medication is selected */}
        {selectedMedication && (
          <>
            {/* Custom Medication Editable Card */}
            {isCustomMedication && (
              <Card className="p-3 bg-amber-50 border-amber-200 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-xs">Custom Medication</h4>
                  <Badge variant="outline" className="text-[10px]">Not in database</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  The Generic Name below is printed on the prescription. Dose-range guidance and drug info are not available for custom medications — double-check the dose manually.
                </p>
                <div className="space-y-1">
                  <Label className="text-[10px]">Generic Name <span className="text-red-600">*</span></Label>
                  <Input
                    type="text"
                    placeholder="e.g., Methadone Hydrochloride"
                    value={customGenericName}
                    onChange={(e) => handleCustomGenericNameChange(e.target.value)}
                    className="h-7 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Schedule Class (optional)</Label>
                  <Select
                    value={customScheduleClass || 'none'}
                    onValueChange={(value) => handleCustomScheduleChange(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-[11px]">None</SelectItem>
                      <SelectItem value="S2" className="text-[11px]">S2</SelectItem>
                      <SelectItem value="S3" className="text-[11px]">S3</SelectItem>
                      <SelectItem value="S4" className="text-[11px]">S4</SelectItem>
                      <SelectItem value="S8" className="text-[11px]">S8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            )}

            {/* Medication Information Display (read-only, stock medications only) */}
            {!isCustomMedication && (
            <Card className="p-3 bg-muted/50 space-y-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-xs">{selectedMedication.genericName}</h4>
                <Badge variant="outline" className="text-[10px]">
                  {selectedMedication.category}
                </Badge>
                {selectedMedication.scheduleClass && (
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedMedication.scheduleClass}
                  </Badge>
                )}
              </div>

              {selectedMedication.brandNames.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Brand names: {selectedMedication.brandNames.join(', ')}
                </p>
              )}

              <div className="pt-2">
                <p className="text-[10px] font-medium">Description:</p>
                <p className="text-[10px] text-muted-foreground">{selectedMedication.description}</p>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-medium">Dosing:</p>
                <div className="space-y-0.5">
                  {(selectedMedication.species.includes('Dog') || selectedMedication.species.includes('Both')) && (
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Dog dose:</span> {selectedMedication.doseRange.min} - {selectedMedication.doseRange.max} {selectedMedication.doseRange.unit}
                    </p>
                  )}
                  {(selectedMedication.species.includes('Cat') || selectedMedication.species.includes('Both')) && (
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Cat dose:</span> {selectedMedication.doseRange.min} - {selectedMedication.doseRange.max} {selectedMedication.doseRange.unit}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-medium">Important Notes:</p>
                <p className="text-[10px] text-muted-foreground">{selectedMedication.notes}</p>
              </div>
            </div>
          </Card>
            )}

            {/* Formulation Type */}
            <div className="space-y-1">
              <Label className="text-[10px]">Formulation</Label>
              <Select
                value={prescriptionData.formulation}
                onValueChange={(value) => setPrescriptionData(prev => ({ ...prev, formulation: value }))}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Choose formulation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tablet" className="text-[11px]">Tablet</SelectItem>
                  <SelectItem value="Capsule" className="text-[11px]">Capsule</SelectItem>
                  <SelectItem value="Liquid/Solution" className="text-[11px]">Liquid/Solution</SelectItem>
                  <SelectItem value="Suspension" className="text-[11px]">Suspension</SelectItem>
                  <SelectItem value="Chewable Tablet" className="text-[11px]">Chewable Tablet</SelectItem>
                  <SelectItem value="Transdermal Gel" className="text-[11px]">Transdermal Gel</SelectItem>
                  <SelectItem value="Injectable" className="text-[11px]">Injectable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dose Concentration */}
            <div className="space-y-1">
              <Label className="text-[10px]">Dose Concentration</Label>
              <Input
                type="text"
                placeholder="e.g., 20mg per tablet, 2mg/ml"
                value={prescriptionData.doseConcentration}
                onChange={(e) => setPrescriptionData(prev => ({ ...prev, doseConcentration: e.target.value }))}
                className="h-7 text-[11px]"
              />
              <p className="text-[9px] text-muted-foreground">Enter concentration (e.g., "20mg per tablet" or "2mg/ml")</p>
            </div>

            {/* Amount to Dispense */}
            <div className="space-y-1">
              <Label className="text-[10px]">Amount to Dispense</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g., 28"
                value={prescriptionData.amountToDispense}
                onChange={(e) => setPrescriptionData(prev => ({ ...prev, amountToDispense: e.target.value }))}
                className="h-7 text-[11px]"
              />
              <p className="text-[9px] text-muted-foreground">Total quantity to dispense (e.g., "28" tablets)</p>
            </div>

            {/* Prescription Details Form */}
            <div className="space-y-2 pt-2">
              {/* Custom dosage directions toggle */}
              <div className="flex items-center gap-2 pb-1">
                <Checkbox
                  id="useCustomDirections"
                  checked={prescriptionData.useCustomDirections}
                  onCheckedChange={(checked) =>
                    setPrescriptionData(prev => ({ ...prev, useCustomDirections: checked === true }))
                  }
                />
                <label htmlFor="useCustomDirections" className="text-[10px] cursor-pointer select-none">
                  Write custom dosage directions (free text, for tapers / PRN / complex schedules)
                </label>
              </div>

              {prescriptionData.useCustomDirections ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Pet Weight */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Pet Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="e.g., 15.5"
                        value={prescriptionData.petWeight}
                        onChange={(e) => setPrescriptionData(prev => ({ ...prev, petWeight: e.target.value }))}
                        className="h-7 text-[11px]"
                      />
                      {calculateSuggestedDose() && (
                        <p className="text-[10px] text-muted-foreground">
                          Suggested: {calculateSuggestedDose()}
                        </p>
                      )}
                    </div>

                    {/* Repeats */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Repeats</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="e.g., 0"
                        value={prescriptionData.repeats}
                        onChange={(e) => setPrescriptionData(prev => ({ ...prev, repeats: e.target.value }))}
                        className="h-7 text-[11px]"
                        required
                      />
                    </div>
                  </div>

                  {/* Custom Dosage Directions */}
                  <div className="space-y-1">
                    <Label className="text-[10px]">Dosage &amp; Administration Directions <span className="text-red-600">*</span></Label>
                    <Textarea
                      placeholder={`e.g., 5 tablets (25 mg) once daily with food for 7 days, then 3 tablets (15 mg) once daily for 7 days, then 1 tablet (5 mg) once daily for 7 days, then cease.`}
                      value={prescriptionData.customDirections}
                      onChange={(e) => setPrescriptionData(prev => ({ ...prev, customDirections: e.target.value }))}
                      className="min-h-[90px] text-[11px]"
                    />
                    <p className="text-[9px] text-muted-foreground">
                      This text is printed on the prescription exactly as written. Include formulation strength and duration if relevant.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Pet Weight */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Pet Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="e.g., 15.5"
                        value={prescriptionData.petWeight}
                        onChange={(e) => setPrescriptionData(prev => ({ ...prev, petWeight: e.target.value }))}
                        className="h-7 text-[11px]"
                      />
                      {calculateSuggestedDose() && (
                        <p className="text-[10px] text-muted-foreground">
                          Suggested: {calculateSuggestedDose()}
                        </p>
                      )}
                    </div>

                    {/* Dose Rate */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Dose Rate</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="e.g., 1, 0.5, 5"
                        value={prescriptionData.doseRate}
                        onChange={(e) => setPrescriptionData(prev => ({ ...prev, doseRate: e.target.value }))}
                        className="h-7 text-[11px]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Frequency */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Frequency</Label>
                      <Select
                        value={prescriptionData.frequency}
                        onValueChange={(value) => setPrescriptionData(prev => ({ ...prev, frequency: value }))}
                      >
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map((freq) => (
                            <SelectItem key={freq.value} value={freq.value} className="text-[11px]">
                              {freq.label} ({freq.latinAbbr})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Repeats */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Repeats</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="e.g., 5"
                        value={prescriptionData.repeats}
                        onChange={(e) => setPrescriptionData(prev => ({ ...prev, repeats: e.target.value }))}
                        className="h-7 text-[11px]"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Special Instructions */}
              <div className="space-y-1">
                <Label className="text-[10px]">Special Instructions (Optional)</Label>
                <Textarea
                  placeholder="e.g., Give with food, Start at lower dose and increase after 1 week..."
                  value={prescriptionData.specialInstructions}
                  onChange={(e) => setPrescriptionData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  className="min-h-[60px] text-[11px]"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      {selectedMedication
        && (prescriptionData.useCustomDirections ? prescriptionData.customDirections.trim() : prescriptionData.doseRate)
        && (!isCustomMedication || customGenericName.trim()) && (
        <div className="space-y-2 pt-2 border-t">
          <div className="space-y-2">
            {/* Generate DOCX Button */}
            <Button
              onClick={() => {
                // Reset mutation state before regenerating
                generateDOCXMutation.reset();
                generateDOCXMutation.mutate();
              }}
              disabled={generateDOCXMutation.isPending || !event?.eventId || !clientFolderPath}
              className="w-full h-8 text-[11px]"
              variant={docxFilePath ? "outline" : "default"}
            >
              {generateDOCXMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : docxFilePath ? (
                <>
                  <FileCheck className="mr-2 h-3 w-3" />
                  Regenerate DOCX
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-3 w-3" />
                  Generate Prescription (DOCX)
                </>
              )}
            </Button>

            {/* Convert to PDF Button */}
            {docxFilePath && (
              <Button
                onClick={() => {
                  // Reset mutation state before converting (clears any previous error)
                  convertToPDFMutation.reset();
                  convertToPDFMutation.mutate();
                }}
                disabled={convertToPDFMutation.isPending}
                className="w-full h-8 text-[11px]"
                variant={pdfFilePath ? "outline" : "default"}
              >
                {convertToPDFMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Converting to PDF...
                  </>
                ) : pdfFilePath ? (
                  <>
                    <FileCheck className="mr-2 h-3 w-3" />
                    Regenerate PDF
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-3 w-3" />
                    Convert to PDF
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Status Messages */}
          <div className="space-y-1">
            {generateDOCXMutation.isError && (
              <p className="text-[10px] text-red-600">
                Error: {generateDOCXMutation.error?.message || "Failed to generate prescription"}
              </p>
            )}
            {docxFilePath && (
              <p className="text-[10px] text-green-600">
                ✓ DOCX saved: {docxFilePath.split('\\').pop()}
              </p>
            )}
            {docxFilePath && !pdfFilePath && !convertToPDFMutation.isPending && (
              <p className="text-[10px] text-amber-600">
                ⚠ Close the DOCX in Word before converting to PDF
              </p>
            )}
            {convertToPDFMutation.isError && (
              <p className="text-[10px] text-red-600">
                Error: {convertToPDFMutation.error?.message || "Failed to convert to PDF"}
              </p>
            )}
            {pdfFilePath && (
              <p className="text-[10px] text-green-600">
                ✓ PDF ready for review: {pdfFilePath.split('\\').pop()}
              </p>
            )}
          </div>

          {!event?.eventId && (
            <p className="text-[10px] text-amber-600">
              ⚠ Please save the event first before generating prescription
            </p>
          )}
        </div>
      )}
    </div>
  );
}
