import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, FileCheck, AlertCircle } from "lucide-react";
import { Event, Pet } from "@/lib/types";
import { EventSpecificPanelProps } from "./EventSpecificPanelProps";
import { BEHAVIOR_MEDICATIONS, Medication, getMedicationById, FREQUENCY_OPTIONS } from "@/lib/medications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { updateEvent } from "@/lib/services/eventService";
import { getPetsByClientId } from "@/lib/services/petService";
import { format } from "date-fns";

interface PrescriptionData {
  petId: string;
  petName: string;
  petSpecies: string;
  medicationId: string;
  doseAmount: string; // e.g., "20" (mg)
  frequency: string; // e.g., "twice_daily"
  repeats: string; // e.g., "5"
  specialInstructions: string;
  petWeight?: string; // Optional: for dose calculations
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
    doseAmount: '',
    frequency: 'twice_daily',
    repeats: '5',
    specialInstructions: '',
    petWeight: '',
  });
  const [docxFilePath, setDocxFilePath] = useState<string>('');
  const [pdfFilePath, setPdfFilePath] = useState<string>('');

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
    const medication = getMedicationById(medicationId);
    setSelectedMedication(medication || null);
    setPrescriptionData(prev => ({
      ...prev,
      medicationId,
      frequency: medication?.defaultFrequency.toLowerCase().replace(/ /g, '_') || 'twice_daily',
    }));
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

      // Prepare prescription content
      const frequencyLabel = FREQUENCY_OPTIONS.find(f => f.value === prescriptionData.frequency)?.label || prescriptionData.frequency;
      const prescriptionContent = generatePrescriptionText();

      // Generate filename
      const consultationDate = format(new Date(formData.date || new Date()), "yyyyMMdd");
      const clientSurname = clientName.split(' ').pop() || 'client';
      const docxFileName = `${clientSurname.toLowerCase()}_${consultationDate}_prescription_${selectedMedication.genericName.toLowerCase()}.docx`;
      const docxFilePath = `${clientFolderPath}\\${docxFileName}`;

      // Call Tauri command to generate DOCX from template
      await invoke<string>("generate_prescription_docx", {
        templateName: "Prescription_Template.docx",
        outputPath: docxFilePath,
        prescriptionData: {
          clientName,
          petName: prescriptionData.petName || "Pet",
          petSpecies: prescriptionData.petSpecies || "Dog",
          petWeight: prescriptionData.petWeight || "Unknown",
          medicationName: selectedMedication.genericName,
          brandNames: selectedMedication.brandNames.join(", "),
          doseAmount: prescriptionData.doseAmount,
          frequency: frequencyLabel,
          repeats: prescriptionData.repeats,
          specialInstructions: prescriptionData.specialInstructions,
          prescriptionDate: format(new Date(), "dd/MM/yyyy"),
          scheduleClass: selectedMedication.scheduleClass || "N/A",
        },
      });

      // Update event with prescription details
      await updateEvent(event.eventId, {
        notes: prescriptionContent,
      });

      return { docxFilePath, docxFileName };
    },
    onSuccess: ({ docxFilePath }) => {
      setDocxFilePath(docxFilePath);
    },
    onError: (error) => {
      console.error("DOCX generation failed:", error);
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

<h3>Dosing</h3>
<p><strong>Dose:</strong> ${prescriptionData.doseAmount} mg</p>
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

        {/* Medication Information Display */}
        {selectedMedication && (
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
                <p className="text-[10px] font-medium">Dose Range:</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedMedication.doseRange.min} - {selectedMedication.doseRange.max} {selectedMedication.doseRange.unit}
                </p>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-medium">Common Indications:</p>
                <ul className="text-[10px] text-muted-foreground list-disc list-inside">
                  {selectedMedication.indications.slice(0, 3).map((indication, idx) => (
                    <li key={idx}>{indication}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-medium">Important Notes:</p>
                <p className="text-[10px] text-muted-foreground">{selectedMedication.notes}</p>
              </div>

              {selectedMedication.contraindications.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-orange-600" />
                    <p className="text-[10px] font-medium text-orange-600">Contraindications:</p>
                  </div>
                  <ul className="text-[10px] text-muted-foreground list-disc list-inside">
                    {selectedMedication.contraindications.map((contra, idx) => (
                      <li key={idx}>{contra}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Prescription Details Form */}
        {selectedMedication && (
          <div className="space-y-2 pt-2">
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

              {/* Dose Amount */}
              <div className="space-y-1">
                <Label className="text-[10px]">Dose Amount (mg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 20"
                  value={prescriptionData.doseAmount}
                  onChange={(e) => setPrescriptionData(prev => ({ ...prev, doseAmount: e.target.value }))}
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
        )}
      </div>

      {/* Action Buttons */}
      {selectedMedication && prescriptionData.doseAmount && (
        <div className="space-y-2 pt-2 border-t">
          <div className="space-y-2">
            {/* Generate DOCX Button */}
            <Button
              onClick={() => generateDOCXMutation.mutate()}
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
                  DOCX Generated
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
                onClick={() => convertToPDFMutation.mutate()}
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
                    PDF Generated
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
          {!clientFolderPath && (
            <p className="text-[10px] text-amber-600">
              ⚠ Client folder not created - please create folder first
            </p>
          )}
        </div>
      )}
    </div>
  );
}
