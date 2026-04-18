/**
 * PetSplitDialog — one-off tool to split a mashed pet record into multiple pets.
 *
 * Used to clean up records where a booking or questionnaire crammed two or
 * more animals into a single Pet row (e.g. "Teddy & Bear" with breed
 * "Golden Retriever & Bernese Mountain Dog"). Pre-parses the name and breed
 * on common separators; the user reviews, adjusts, and confirms.
 *
 * On confirm:
 *   1. createPet() for each new pet (sequentially, so an error halts)
 *   2. deletePet() for the original
 *
 * Event and Task rows reference pets by clientId only (no petId FK), so
 * no rewiring is needed after deletion.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { createPet, deletePet } from '@/lib/services/petService';
import type { Pet } from '@/lib/types';
import { PET_SPECIES } from '@/lib/types';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export interface PetSplitDialogProps {
  pet: Pet;
  isOpen: boolean;
  onClose: () => void;
}

/** Split a string on common multi-pet separators. */
function splitOnSeparators(input: string): string[] {
  if (!input) return [];
  // Try " & " first, then " and ", then ",", then "/"
  const separators: Array<RegExp> = [
    /\s+&\s+/,
    /\s+and\s+/i,
    /\s*,\s*/,
    /\s*\/\s*/,
  ];
  for (const sep of separators) {
    if (sep.test(input)) {
      return input.split(sep).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [input.trim()];
}

interface SplitRow {
  name: string;
  species: string;
  breed: string;
  notes: string;
}

export function PetSplitDialog({ pet, isOpen, onClose }: PetSplitDialogProps) {
  const queryClient = useQueryClient();

  // Pre-parse name and breed on common separators. Zip when counts match.
  const initialRows = useMemo<SplitRow[]>(() => {
    const names = splitOnSeparators(pet.name);
    const breeds = splitOnSeparators(pet.breed || '');
    const count = Math.max(names.length, 2);

    const rows: SplitRow[] = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        name: names[i] || '',
        species: pet.species,
        breed: breeds.length === names.length ? (breeds[i] || '') : (pet.breed || ''),
        notes: '',
      });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.petId]);

  const [rows, setRows] = useState<SplitRow[]>(initialRows);
  const [confirmOriginal, setConfirmOriginal] = useState(false);

  const splitMutation = useMutation({
    mutationFn: async () => {
      // 1. Create all new pets sequentially (halts on error)
      for (const row of rows) {
        await createPet({
          clientId: pet.clientId,
          name: row.name.trim(),
          species: row.species.trim(),
          breed: row.breed.trim() || undefined,
          notes: row.notes.trim() || undefined,
        });
      }
      // 2. Delete original
      await deletePet(pet.petId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pets', pet.clientId] });
      queryClient.invalidateQueries({ queryKey: ['client', pet.clientId] });
      toast.success(`Split "${pet.name}" into ${rows.length} pets`);
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to split pet', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  function updateRow(index: number, patch: Partial<SplitRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { name: '', species: pet.species, breed: '', notes: '' }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const canSubmit =
    rows.length >= 2 &&
    rows.every((r) => r.name.trim().length > 0 && r.species.trim().length > 0) &&
    confirmOriginal &&
    !splitMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Pet: {pet.name}</DialogTitle>
          <DialogDescription>
            Split this pet record into multiple pets. Each new pet is created with its own
            record; the original is deleted. Weight, DOB, sex and other fields are intentionally
            left blank on each split — adjust them individually afterwards in each pet's form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded p-2">
            <strong>Original record:</strong> {pet.name}
            {pet.breed && ` — ${pet.breed}`} — {pet.species}
            <br />
            <strong>Will be deleted.</strong> Events and tasks are linked to the client, not to
            this pet, so they are unaffected.
          </div>

          {rows.map((row, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Pet {i + 1}</Label>
                {rows.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(i)}
                    className="h-7 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    className="h-8"
                    placeholder="Pet name"
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    Species <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={row.species}
                    onValueChange={(v) => updateRow(i, { species: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PET_SPECIES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Breed</Label>
                  <Input
                    value={row.breed}
                    onChange={(e) => updateRow(i, { breed: e.target.value })}
                    className="h-8"
                    placeholder="Breed (optional)"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={row.notes}
                    onChange={(e) => updateRow(i, { notes: e.target.value })}
                    rows={2}
                    className="text-sm min-h-[50px]"
                    placeholder="Pet-specific notes (optional)"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= 5}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add another pet
          </Button>

          <div className="flex items-start gap-2 pt-2 border-t">
            <input
              type="checkbox"
              id="confirm-original"
              checked={confirmOriginal}
              onChange={(e) => setConfirmOriginal(e.target.checked)}
              className="mt-1"
            />
            <Label htmlFor="confirm-original" className="text-xs cursor-pointer">
              I understand the original pet record "{pet.name}" will be permanently deleted
              after the new pets are created.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={splitMutation.isPending}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancel
          </Button>
          <Button
            onClick={() => splitMutation.mutate()}
            disabled={!canSubmit}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {splitMutation.isPending
              ? `Splitting…`
              : `Split into ${rows.length} pets`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
