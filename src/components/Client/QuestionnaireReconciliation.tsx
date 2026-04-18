/**
 * Questionnaire Reconciliation Component
 *
 * Per-pet reconciliation — one card per parsed pet, each with a pet-picker
 * dropdown that lets the user re-route the questionnaire pet to any of the
 * client's existing pets or create a new pet.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  reconcileQuestionnaire,
  recomputePetReconciliation,
  applyClientUpdates,
  applyPetUpdatesFromParsed,
  createPetFromParsed,
  type ReconciliationResult,
  type PerPetReconciliation,
  type FieldComparison,
} from '@/lib/services/questionnaireReconciliationService';
import { AlertCircle, CheckCircle2, Info, Plus, PawPrint } from 'lucide-react';

interface QuestionnaireReconciliationProps {
  clientId: number;
  questionnaireFilePath: string;
  onClose: () => void;
  onUpdateComplete: () => void;
}

/** Per-pet UI state — target + selected fields to apply. */
interface PetUiState {
  /** 'create' or the string form of an existing petId. */
  targetKey: string;
  selectedFields: string[];
}

const CREATE_KEY = 'create';

export function QuestionnaireReconciliation({
  clientId,
  questionnaireFilePath,
  onClose,
  onUpdateComplete,
}: QuestionnaireReconciliationProps) {
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientFields, setSelectedClientFields] = useState<string[]>([]);
  const [petUiStates, setPetUiStates] = useState<PetUiState[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadReconciliation();
  }, [clientId, questionnaireFilePath]);

  async function loadReconciliation() {
    try {
      setLoading(true);
      setError(null);
      const result = await reconcileQuestionnaire(clientId, questionnaireFilePath);
      setReconciliation(result);

      setSelectedClientFields(
        result.client.comparisons.filter((c) => c.status === 'new').map((c) => c.field)
      );
      setPetUiStates(
        result.pets.map((p) => ({
          targetKey: p.targetPet ? String(p.targetPet.petId) : CREATE_KEY,
          selectedFields: p.comparisons.filter((c) => c.status === 'new').map((c) => c.field),
        }))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[QuestionnaireReconciliation] Load failed:', err);
      setError(msg);
      setReconciliation(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleClientField(field: string) {
    setSelectedClientFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  function togglePetField(petIndex: number, field: string) {
    setPetUiStates((prev) => {
      const next = [...prev];
      const current = next[petIndex];
      const selected = current.selectedFields.includes(field)
        ? current.selectedFields.filter((f) => f !== field)
        : [...current.selectedFields, field];
      next[petIndex] = { ...current, selectedFields: selected };
      return next;
    });
  }

  /**
   * User picked a different target pet (or "Create new") for this parsed pet.
   * Recompute comparisons pure-side and reset selected fields to auto-selected
   * (status=new) for the new target.
   */
  function handleTargetChange(petIndex: number, newKey: string) {
    if (!reconciliation) return;
    const parsedPet = reconciliation.pets[petIndex].parsedPet;
    const targetPet = newKey === CREATE_KEY
      ? null
      : reconciliation.allClientPets.find((p) => String(p.petId) === newKey) ?? null;
    const updatedPer = recomputePetReconciliation(parsedPet, targetPet);

    setReconciliation((prev) => {
      if (!prev) return prev;
      const pets = [...prev.pets];
      pets[petIndex] = updatedPer;
      return { ...prev, pets };
    });

    setPetUiStates((prev) => {
      const next = [...prev];
      next[petIndex] = {
        targetKey: newKey,
        selectedFields: updatedPer.comparisons
          .filter((c) => c.status === 'new')
          .map((c) => c.field),
      };
      return next;
    });
  }

  async function handleApplyUpdates() {
    if (!reconciliation) return;
    try {
      setApplying(true);

      if (selectedClientFields.length > 0) {
        await applyClientUpdates(
          reconciliation.client.record,
          selectedClientFields,
          reconciliation.questionnaireData
        );
      }

      for (let i = 0; i < reconciliation.pets.length; i++) {
        const per = reconciliation.pets[i];
        const ui = petUiStates[i];
        if (!ui || ui.selectedFields.length === 0 && ui.targetKey !== CREATE_KEY) continue;

        if (ui.targetKey === CREATE_KEY) {
          // Creating a new pet: always create if at least one field is selected
          // OR the parsed pet has the minimum required fields (name+species).
          await createPetFromParsed(clientId, per.parsedPet, ui.selectedFields);
        } else if (per.targetPet) {
          await applyPetUpdatesFromParsed(per.targetPet, per.parsedPet, ui.selectedFields);
        }
      }

      onUpdateComplete();
      onClose();
    } catch (err) {
      console.error('Apply updates failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  function getStatusIcon(status: FieldComparison['status']) {
    switch (status) {
      case 'match': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'new': return <Plus className="w-4 h-4 text-blue-600" />;
      case 'different': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'missing': return <Info className="w-4 h-4 text-yellow-600" />;
    }
  }

  function getStatusBadge(status: FieldComparison['status']) {
    switch (status) {
      case 'match': return <Badge variant="outline" className="text-green-600">Match</Badge>;
      case 'new': return <Badge variant="outline" className="text-blue-600">New</Badge>;
      case 'different': return <Badge variant="outline" className="text-red-600">Different</Badge>;
      case 'missing': return <Badge variant="outline" className="text-yellow-600">Missing</Badge>;
    }
  }

  function renderFieldComparison(
    comparison: FieldComparison,
    isSelected: boolean,
    onToggle: () => void
  ) {
    const actionable = comparison.status === 'new' || comparison.status === 'different';
    const rowClass =
      comparison.status === 'different' ? 'bg-red-50 border-red-200' :
      comparison.status === 'missing' ? 'bg-yellow-50 border-yellow-200' :
      comparison.status === 'new' ? 'bg-blue-50 border-blue-200' :
      'bg-white';

    return (
      <div key={comparison.field} className={`border rounded-md p-3 ${rowClass}`}>
        <div className="flex items-start gap-3">
          {actionable
            ? <Checkbox checked={isSelected} onCheckedChange={onToggle} className="mt-1" />
            : <div className="w-5" />}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(comparison.status)}
              <span className="font-medium">{comparison.label}</span>
              {getStatusBadge(comparison.status)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Current:</span>
                <div className="font-mono">
                  {comparison.currentValue || <em className="text-gray-400">empty</em>}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Questionnaire:</span>
                <div className="font-mono">
                  {comparison.questionnaireValue || <em className="text-gray-400">empty</em>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPetCard(per: PerPetReconciliation, petIndex: number) {
    const ui = petUiStates[petIndex];
    if (!ui || !reconciliation) return null;
    const isCreate = ui.targetKey === CREATE_KEY;

    return (
      <Card key={petIndex}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <PawPrint className="w-5 h-5" />
                Pet: {per.parsedPet.name}
                <span className="text-sm text-gray-500 font-normal">
                  ({per.parsedPet.species})
                </span>
              </CardTitle>
              <CardDescription>
                {per.autoMatched
                  ? <span className="text-green-600">Auto-matched by name</span>
                  : <span className="text-amber-600">
                      No auto-match — pick a target below or create a new pet
                    </span>}
              </CardDescription>
            </div>

            {/* Pet picker dropdown */}
            <div className="w-72">
              <label className="text-xs text-gray-500 mb-1 block">Target pet</label>
              <Select value={ui.targetKey} onValueChange={(v) => handleTargetChange(petIndex, v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reconciliation.allClientPets.map((p) => (
                    <SelectItem key={p.petId} value={String(p.petId)}>
                      Update: {p.name} ({p.species})
                    </SelectItem>
                  ))}
                  <SelectItem value={CREATE_KEY}>
                    + Create new pet
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {per.comparisons
              .filter((c) => {
                // Update mode: hide name/species — use Split tool to change those.
                // Create mode: name/species are implicit (from parsed pet) so hide too.
                if (c.field === 'name' || c.field === 'species') return false;
                return isCreate ? c.questionnaireValue != null : c.status !== 'match';
              })
              .map((comparison) =>
                renderFieldComparison(
                  comparison,
                  ui.selectedFields.includes(comparison.field),
                  () => togglePetField(petIndex, comparison.field)
                )
              )}
            {isCreate ? (
              <p className="text-xs text-gray-500 mt-2">
                Creating a new pet. Name and species are required and will be taken from the
                questionnaire. Tick any other fields to include.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                Updating <strong>{per.targetPet?.name}</strong>. Name and species are not
                changeable here — use the Split tool on the Pets table if you need to
                restructure pet records.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading questionnaire data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-600" />
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600 mb-2">
            Failed to load questionnaire data
          </p>
          <p className="text-sm text-gray-600">{error}</p>
          <p className="text-xs text-gray-500 mt-2">File: {questionnaireFilePath}</p>
        </div>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    );
  }

  if (!reconciliation) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-600">Failed to load questionnaire data</p>
      </div>
    );
  }

  const totalSelections =
    selectedClientFields.length + petUiStates.reduce((n, s) => n + s.selectedFields.length, 0);
  const anyCreates = petUiStates.some((s) => s.targetKey === CREATE_KEY);
  const hasClientChanges = reconciliation.client.hasChanges;
  const hasPetChanges = reconciliation.pets.some((p) => p.hasChanges) || anyCreates;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Questionnaire Reconciliation</h2>
          <p className="text-gray-600">
            Review questionnaire data and apply updates to client and pet records
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>

      {/* Questionnaire meta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Questionnaire Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Submission ID:</span>
              <div className="font-mono">{reconciliation.questionnaireData.submissionId}</div>
            </div>
            <div>
              <span className="text-gray-500">Form Type:</span>
              <div>
                <Badge
                  variant={reconciliation.questionnaireData.formType === 'Dog' ? 'default' : 'secondary'}
                >
                  {reconciliation.questionnaireData.formType} Behaviour Questionnaire
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Pets reported:</span>
              <div>{reconciliation.pets.length}</div>
            </div>
            <div>
              <span className="text-gray-500">Submitted:</span>
              <div>{new Date(reconciliation.questionnaireData.submittedAt).toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All-match short-circuit */}
      {!hasClientChanges && !hasPetChanges && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">All Fields Match</h3>
              <p className="text-gray-600">
                Questionnaire data matches existing records. No updates needed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Comparisons */}
      {hasClientChanges && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Client Information</CardTitle>
            <CardDescription>
              {reconciliation.client.comparisons.filter((c) => c.status === 'different').length > 0 && (
                <span className="text-red-600 font-semibold">
                  ⚠️ Conflicts detected — review carefully
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reconciliation.client.comparisons
                .filter((c) => c.status !== 'match')
                .map((comparison) =>
                  renderFieldComparison(
                    comparison,
                    selectedClientFields.includes(comparison.field),
                    () => toggleClientField(comparison.field)
                  )
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-pet cards */}
      {reconciliation.pets.map((per, i) => renderPetCard(per, i))}

      {/* Action Buttons */}
      {(hasClientChanges || hasPetChanges) && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleApplyUpdates}
            disabled={applying}
          >
            {applying ? 'Applying Updates...' : `Apply ${totalSelections} Update(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}
