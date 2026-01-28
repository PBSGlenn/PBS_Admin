// PBS Admin - Pet Form Component
// Form for creating/editing pets

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createPet, updatePet } from "@/lib/services/petService";
import { PET_SPECIES, PET_SEX } from "@/lib/types";
import type { Pet, PetInput } from "@/lib/types";
import { parseAgeToDateOfBirth, calculateAge } from "@/lib/utils/ageUtils";
import { toast } from "sonner";
import { Save, X, Calculator } from "lucide-react";
import { toast } from "sonner";

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
    dateOfBirth: pet?.dateOfBirth || "",
    notes: pet?.notes || "",
  });

  const [ageInput, setAgeInput] = useState("");
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const input: PetInput = {
        clientId,
        name: formData.name.trim(),
        species: formData.species.trim(),
        breed: formData.breed.trim() || undefined,
        sex: formData.sex || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
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

    if (field === "name" && !value.trim()) {
      fieldError = "Pet name is required";
    } else if (field === "species" && !value.trim()) {
      fieldError = "Species is required";
    }

    setErrors(prev => ({
      ...prev,
      [field]: fieldError
    }));
  };

  // Handle age input and calculate DOB
  const handleAgeInput = (value: string) => {
    setAgeInput(value);

    if (!value.trim()) {
      setCalculatedDob(null);
      return;
    }

    const dob = parseAgeToDateOfBirth(value);
    if (dob) {
      setCalculatedDob(dob);
      setFormData(prev => ({ ...prev, dateOfBirth: dob }));
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
        <div className="space-y-2">
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

        {/* Age Calculator */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="ageInput" className="text-sm">
            Age (from questionnaire)
            <span className="text-xs text-muted-foreground ml-2">
              e.g., "2 years", "18 months", "12 weeks"
            </span>
          </Label>
          <div className="relative">
            <Input
              id="ageInput"
              value={ageInput}
              onChange={(e) => handleAgeInput(e.target.value)}
              className="h-9 pr-10"
              placeholder="Enter age as provided by owner..."
            />
            <Calculator className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          {calculatedDob && (
            <p className="text-xs text-muted-foreground">
              Calculated DOB: {new Date(calculatedDob).toLocaleDateString('en-AU')}
              {formData.dateOfBirth && ` (${calculateAge(formData.dateOfBirth)})`}
            </p>
          )}
        </div>

        {/* Date of Birth */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="dateOfBirth" className="text-sm">
            Date of Birth
            <span className="text-xs text-muted-foreground ml-2">
              (auto-filled from age, can be manually adjusted)
            </span>
          </Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            className="h-9"
          />
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
