/**
 * Questionnaire Reconciliation Component
 * Displays comparison between questionnaire data and existing client/pet records
 * Allows user to review conflicts and selectively apply updates
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  reconcileQuestionnaire,
  applyClientUpdates,
  applyPetUpdates,
  createPetFromQuestionnaire,
  type ReconciliationResult,
  type FieldComparison,
} from '@/lib/services/questionnaireReconciliationService';
import { AlertCircle, CheckCircle2, Info, Plus } from 'lucide-react';

interface QuestionnaireReconciliationProps {
  clientId: number;
  questionnaireFilePath: string;
  onClose: () => void;
  onUpdateComplete: () => void;
}

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
  const [selectedPetFields, setSelectedPetFields] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadReconciliation();
  }, [clientId, questionnaireFilePath]);

  async function loadReconciliation() {
    try {
      setLoading(true);
      setError(null);

      console.log('[QuestionnaireReconciliation] Loading from:', questionnaireFilePath);
      const result = await reconcileQuestionnaire(clientId, questionnaireFilePath);
      console.log('[QuestionnaireReconciliation] Reconciliation result:', result);

      setReconciliation(result);

      // Pre-select fields with new data (not different or missing)
      const autoSelectClient = result.client.comparisons
        .filter(c => c.status === 'new')
        .map(c => c.field);
      const autoSelectPet = result.pet.comparisons
        .filter(c => c.status === 'new')
        .map(c => c.field);

      setSelectedClientFields(autoSelectClient);
      setSelectedPetFields(autoSelectPet);
    } catch (error) {
      console.error('[QuestionnaireReconciliation] Failed to load reconciliation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setReconciliation(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleClientField(field: string) {
    setSelectedClientFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  }

  function togglePetField(field: string) {
    setSelectedPetFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  }

  async function handleApplyUpdates() {
    if (!reconciliation) return;

    try {
      setApplying(true);

      // Apply client updates if any selected
      if (selectedClientFields.length > 0) {
        await applyClientUpdates(
          reconciliation.client.record,
          selectedClientFields,
          reconciliation.questionnaireData
        );
      }

      // Apply pet updates if any selected
      if (selectedPetFields.length > 0) {
        if (reconciliation.pet.record) {
          // Pet exists - update it
          await applyPetUpdates(
            reconciliation.pet.record,
            selectedPetFields,
            reconciliation.questionnaireData
          );
        } else {
          // Pet doesn't exist - create it
          await createPetFromQuestionnaire(
            clientId,
            selectedPetFields,
            reconciliation.questionnaireData
          );
        }
      }

      onUpdateComplete();
      onClose();
    } catch (error) {
      console.error('Failed to apply updates:', error);
    } finally {
      setApplying(false);
    }
  }

  function getStatusIcon(status: FieldComparison['status']) {
    switch (status) {
      case 'match':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'new':
        return <Plus className="w-4 h-4 text-blue-600" />;
      case 'different':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'missing':
        return <Info className="w-4 h-4 text-yellow-600" />;
    }
  }

  function getStatusBadge(status: FieldComparison['status']) {
    switch (status) {
      case 'match':
        return <Badge variant="outline" className="text-green-600">Match</Badge>;
      case 'new':
        return <Badge variant="outline" className="text-blue-600">New</Badge>;
      case 'different':
        return <Badge variant="outline" className="text-red-600">Different</Badge>;
      case 'missing':
        return <Badge variant="outline" className="text-yellow-600">Missing</Badge>;
    }
  }

  function renderFieldComparison(
    comparison: FieldComparison,
    isSelected: boolean,
    onToggle: () => void
  ) {
    const isActionable = comparison.status === 'new' || comparison.status === 'different';
    const rowClass = comparison.status === 'different'
      ? 'bg-red-50 border-red-200'
      : comparison.status === 'missing'
      ? 'bg-yellow-50 border-yellow-200'
      : comparison.status === 'new'
      ? 'bg-blue-50 border-blue-200'
      : 'bg-white';

    return (
      <div key={comparison.field} className={`border rounded-md p-3 ${rowClass}`}>
        <div className="flex items-start gap-3">
          {isActionable && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggle}
              className="mt-1"
            />
          )}
          {!isActionable && <div className="w-5" />}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(comparison.status)}
              <span className="font-medium">{comparison.label}</span>
              {getStatusBadge(comparison.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Current:</span>
                <div className="font-mono">{comparison.currentValue || <em className="text-gray-400">empty</em>}</div>
              </div>
              <div>
                <span className="text-gray-500">Questionnaire:</span>
                <div className="font-mono">{comparison.questionnaireValue || <em className="text-gray-400">empty</em>}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
          <p className="text-lg font-semibold text-red-600 mb-2">Failed to load questionnaire data</p>
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

  const hasClientChanges = reconciliation.client.hasChanges;
  const hasPetChanges = reconciliation.pet.hasChanges;
  const hasAnyChanges = hasClientChanges || hasPetChanges;

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
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Questionnaire Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Questionnaire Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Submission ID:</span>
              <div className="font-mono">{reconciliation.questionnaireData.submissionId}</div>
            </div>
            <div>
              <span className="text-gray-500">Form Type:</span>
              <div>
                <Badge variant={reconciliation.questionnaireData.formType === 'Dog' ? 'default' : 'secondary'}>
                  {reconciliation.questionnaireData.formType} Behaviour Questionnaire
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Submitted:</span>
              <div>{new Date(reconciliation.questionnaireData.submittedAt).toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasAnyChanges && (
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
              {reconciliation.client.comparisons.filter(c => c.status === 'different').length > 0 && (
                <span className="text-red-600 font-semibold">
                  ⚠️ Conflicts detected - review carefully
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reconciliation.client.comparisons
                .filter(c => c.status !== 'match')
                .map(comparison =>
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

      {/* Pet Comparisons */}
      {hasPetChanges && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pet Information</CardTitle>
            <CardDescription>
              {reconciliation.pet.comparisons.filter(c => c.status === 'different').length > 0 && (
                <span className="text-red-600 font-semibold">
                  ⚠️ Conflicts detected - review carefully
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reconciliation.pet.comparisons
                .filter(c => c.status !== 'match')
                .map(comparison =>
                  renderFieldComparison(
                    comparison,
                    selectedPetFields.includes(comparison.field),
                    () => togglePetField(comparison.field)
                  )
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {hasAnyChanges && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyUpdates}
            disabled={applying || (selectedClientFields.length === 0 && selectedPetFields.length === 0)}
          >
            {applying ? 'Applying Updates...' : `Apply ${selectedClientFields.length + selectedPetFields.length} Updates`}
          </Button>
        </div>
      )}
    </div>
  );
}
