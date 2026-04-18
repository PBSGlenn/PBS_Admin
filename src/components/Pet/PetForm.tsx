// PBS Admin - Pet Form Component
// Form for creating/editing pets

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createPet, updatePet } from "@/lib/services/petService";
import { PET_SPECIES, PET_SEX, PET_DESEXED } from "@/lib/types";
import type { Pet, PetInput } from "@/lib/types";
import { parseAgeToDateOfBirth, calculateAge } from "@/lib/utils/ageUtils";
import { toast } from "sonner";
import { Save, X, Calculator } from "lucide-react";

export interface PetFormProps {
  clientId: number;
  pet?: Pet | null;
  onClose: () => void;
  onSave?: (pet: Pet) => void;
}

export function PetForm({ clientId, pet, onClose, onSave }: PetFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!pet;

  // Form state
  const [formData, setFormData] = useState({
    name: pet?.name || "",
    species: pet?.species || "",
    breed: pet?.breed || "",
    sex: pet?.sex || "",
    desexed: pet?.desexed || "",
    desexedDate: pet?.desexedDate || "",
    dateOfBirth: pet?.dateOfBirth || "",
    dateOfBirthIsApproximate: pet?.dateOfBirthIsApproximate === 1,
    weightKg: pet?.weightKg != null ? String(pet.weightKg) : "",
    reportedAge: pet?.reportedAge || "",
    notes: pet?.notes || "",
  });

  const [calculatedDob, setCalculatedDob] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Check if all required fields are valid
  const checkFormValidity = () => {
    const hasName = formData.name.trim().length > 0;
    const hasSpecies = formData.species.trim().length > 0;
    return hasName && hasSpecies;
  };

  // Update form validity whenever form data changes
  useEffect(() => {
    setIsFormValid(checkFormValidity());
  }, [formData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (input: PetInput) => createPet(input),
    onSuccess: (savedPet) => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["pets", clientId] });
      if (onSave) onSave(savedPet);
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to create pet", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (input: Partial<PetInput>) => updatePet(pet!.petId, input),
    onSuccess: (savedPet) => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["pets", clientId] });
      if (onSave) onSave(savedPet);
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to update pet", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Form validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Pet name is required";
    }
    if (!formData.species.trim()) {
      newErrors.species = "Species is required";
    }
    if (formData.weightKg && isNaN(parseFloat(formData.weightKg))) {
      newErrors.weightKg = "Weight must be a number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const weightParsed = formData.weightKg ? parseFloat(formData.weightKg) : undefined;
      const input: PetInput = {
        clientId,
        name: formData.name.trim(),
        species: formData.species.trim(),
        breed: formData.breed.trim() || undefined,
        sex: formData.sex || undefined,
        desexed: formData.desexed || undefined,
        desexedDate: formData.desexed === "Yes" && formData.desexedDate ? formData.desexedDate : undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        dateOfBirthIsApproximate: formData.dateOfBirth
          ? (formData.dateOfBirthIsApproximate ? 1 : 0)
          : undefined,
        weightKg: weightParsed != null && !isNaN(weightParsed) ? weightParsed : undefined,
        reportedAge: formData.reportedAge.trim() || undefined,
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
  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Real-time validation for the field being changed
    let fieldError = "";

    if (field === "name" && typeof value === "string" && !value.trim()) {
      fieldError = "Pet name is required";
    } else if (field === "species" && typeof value === "string" && !value.trim()) {
      fieldError = "Species is required";
    }

    setErrors(prev => ({
      ...prev,
      [field]: fieldError
    }));
  };

  // Handle reported-age input and calculate DOB as a helper
  const handleReportedAgeInput = (value: string) => {
    setFormData(prev => ({ ...prev, reportedAge: value }));

    if (!value.trim()) {
      setCalculatedDob(null);
      return;
    }

    const dob = parseAgeToDateOfBirth(value);
    if (dob) {
      setCalculatedDob(dob);
      // Only auto-fill DOB if not already set — never clobber a user-entered DOB.
      setFormData(prev => prev.dateOfBirth
        ? prev
        : { ...prev, dateOfBirth: dob, dateOfBirthIsApproximate: true });
    } else {
      setCalculatedDob(null);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm">
            Pet Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className={`h-9 ${errors.name ? "border-destructive" : ""}`}
            placeholder="e.g., Max"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Species */}
        <div className="space-y-2">
          <Label htmlFor="species" className="text-sm">
            Species <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.species}
            onValueChange={(value) => handleChange("species", value)}
          >
            <SelectTrigger className={`h-9 ${errors.species ? "border-destructive" : ""}`}>
              <SelectValue placeholder="Select species" />
            </SelectTrigger>
            <SelectContent>
              {PET_SPECIES.map(species => (
                <SelectItem key={species} value={species}>
                  {species}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.species && (
            <p className="text-xs text-destructive">{errors.species}</p>
          )}
        </div>

        {/* Breed */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="breed" className="text-sm">Breed</Label>
          <Input
            id="breed"
            value={formData.breed}
            onChange={(e) => handleChange("breed", e.target.value)}
            className="h-9"
            placeholder="e.g., Border Collie"
          />
        </div>

        {/* Sex */}
        <div className="space-y-2">
          <Label htmlFor="sex" className="text-sm">Sex</Label>
          <Select
            value={formData.sex}
            onValueChange={(value) => handleChange("sex", value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select sex" />
            </SelectTrigger>
            <SelectContent>
              {PET_SEX.map(sex => (
                <SelectItem key={sex} value={sex}>
                  {sex}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desexed */}
        <div className="space-y-2">
          <Label htmlFor="desexed" className="text-sm">Desexed</Label>
          <Select
            value={formData.desexed}
            onValueChange={(value) => handleChange("desexed", value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {PET_DESEXED.map(d => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desexed Date — only when desexed=Yes */}
        {formData.desexed === "Yes" && (
          <div className="space-y-2 col-span-2">
            <Label htmlFor="desexedDate" className="text-sm">
              Desexed Date
              <span className="text-xs text-muted-foreground ml-2">(optional)</span>
            </Label>
            <Input
              id="desexedDate"
              type="date"
              value={formData.desexedDate}
              onChange={(e) => handleChange("desexedDate", e.target.value)}
              className="h-9"
            />
          </div>
        )}

        {/* Weight */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="weightKg" className="text-sm">
            Weight (kg)
            <span className="text-xs text-muted-foreground ml-2">e.g., 12.5</span>
          </Label>
          <Input
            id="weightKg"
            type="number"
            step="0.1"
            min="0"
            value={formData.weightKg}
            onChange={(e) => handleChange("weightKg", e.target.value)}
            className={`h-9 ${errors.weightKg ? "border-destructive" : ""}`}
            placeholder="Weight in kilograms"
          />
          {errors.weightKg && (
            <p className="text-xs text-destructive">{errors.weightKg}</p>
          )}
        </div>

        {/* Reported Age + DOB helper */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="reportedAge" className="text-sm">
            Reported Age
            <span className="text-xs text-muted-foreground ml-2">
              owner's words — e.g. "2 years", "18 months", "12 weeks"
            </span>
          </Label>
          <div className="relative">
            <Input
              id="reportedAge"
              value={formData.reportedAge}
              onChange={(e) => handleReportedAgeInput(e.target.value)}
              className="h-9 pr-10"
              placeholder="What did the owner report?"
            />
            <Calculator className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          {calculatedDob && (
            <p className="text-xs text-muted-foreground">
              Calculated approximate DOB: {new Date(calculatedDob).toLocaleDateString('en-AU')}
              {formData.dateOfBirth && ` (${calculateAge(formData.dateOfBirth)})`}
            </p>
          )}
        </div>

        {/* Date of Birth + Approximate flag */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="dateOfBirth" className="text-sm">
            Date of Birth
            <span className="text-xs text-muted-foreground ml-2">
              (auto-filled from reported age; can be manually adjusted)
            </span>
          </Label>
          <div className="flex items-center gap-4">
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleChange("dateOfBirth", e.target.value)}
              className="h-9 flex-1"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="dateOfBirthIsApproximate"
                checked={formData.dateOfBirthIsApproximate}
                onCheckedChange={(checked) =>
                  handleChange("dateOfBirthIsApproximate", checked === true)
                }
                disabled={!formData.dateOfBirth}
              />
              <Label htmlFor="dateOfBirthIsApproximate" className="text-sm font-normal cursor-pointer">
                Approximate
              </Label>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="notes" className="text-sm">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={3}
            placeholder="Any additional information about this pet..."
            className="text-sm min-h-[60px]"
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
          {isPending ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Pet" : "Create Pet")}
        </Button>
      </div>
    </form>
  );
}
