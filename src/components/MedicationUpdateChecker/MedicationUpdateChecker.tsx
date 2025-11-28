// Medication Update Checker Dialog
// UI for reviewing and applying medication brand name updates

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  checkForMedicationUpdates,
  applyMedicationUpdates,
  getUpdateHistory,
  getLastUpdateCheckDate,
  type MedicationUpdate,
  type UpdateCheckResult,
  type UpdateHistory,
} from '@/lib/services/medicationUpdateService';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface MedicationUpdateCheckerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MedicationUpdateChecker({ isOpen, onClose }: MedicationUpdateCheckerProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0, name: '' });
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [updateHistory, setUpdateHistory] = useState<UpdateHistory[]>([]);
  const [lastCheckDate, setLastCheckDate] = useState<Date | null>(null);

  // Load update history and last check date on mount
  useEffect(() => {
    if (isOpen) {
      setUpdateHistory(getUpdateHistory());
      setLastCheckDate(getLastUpdateCheckDate());
    }
  }, [isOpen]);

  // Auto-select all medications with changes
  useEffect(() => {
    if (checkResult) {
      const medicationsWithChanges = checkResult.updates
        .filter(u => u.hasChanges)
        .map(u => u.medicationId);
      setSelectedUpdates(new Set(medicationsWithChanges));
    }
  }, [checkResult]);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    setCheckProgress({ current: 0, total: 0, name: '' });

    try {
      const result = await checkForMedicationUpdates((current, total, name) => {
        setCheckProgress({ current, total, name });
      });

      setCheckResult(result);
      setLastCheckDate(result.lastChecked);

      if (result.totalChanges === 0) {
        toast.success('All medications are up to date!');
      } else {
        toast.info(`Found ${result.totalChanges} medication(s) with brand name updates`);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast.error('Failed to check for updates. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleToggleUpdate = (medicationId: string) => {
    const newSelected = new Set(selectedUpdates);
    if (newSelected.has(medicationId)) {
      newSelected.delete(medicationId);
    } else {
      newSelected.add(medicationId);
    }
    setSelectedUpdates(newSelected);
  };

  const handleApplyUpdates = async () => {
    if (selectedUpdates.size === 0) {
      toast.error('Please select at least one medication to update');
      return;
    }

    setIsApplying(true);

    try {
      const updates = Array.from(selectedUpdates).map(medicationId => {
        const update = checkResult?.updates.find(u => u.medicationId === medicationId);
        return {
          medicationId,
          newBrands: update?.proposedBrands || [],
        };
      });

      const result = await applyMedicationUpdates(updates);

      if (result.success) {
        toast.success(`Successfully updated ${result.appliedCount} medication(s)`);
        setUpdateHistory(getUpdateHistory()); // Refresh history
        setCheckResult(null); // Clear check result
        setSelectedUpdates(new Set()); // Clear selections
      } else {
        toast.error(result.error || 'Failed to apply updates');
      }
    } catch (error) {
      console.error('Failed to apply updates:', error);
      toast.error('Failed to apply updates. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const renderUpdateItem = (update: MedicationUpdate) => {
    const isSelected = selectedUpdates.has(update.medicationId);
    const hasChanges = update.hasChanges;

    return (
      <div
        key={update.medicationId}
        className={`border rounded-lg p-3 ${hasChanges ? 'bg-blue-50/50' : 'bg-gray-50/50'}`}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => handleToggleUpdate(update.medicationId)}
            disabled={!hasChanges}
            className="mt-1"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-semibold">
                {update.genericName}
              </h4>
              <Badge variant="secondary" className="text-[10px]">
                {update.category}
              </Badge>
              {hasChanges && (
                <Badge variant="default" className="text-[10px]">
                  {update.additions.length} new, {update.removals.length} removed
                </Badge>
              )}
              {!hasChanges && (
                <Badge variant="outline" className="text-[10px]">
                  No changes
                </Badge>
              )}
            </div>

            {/* Current Brands */}
            <div className="mb-2">
              <p className="text-[10px] text-muted-foreground mb-1">Current brands:</p>
              <div className="flex flex-wrap gap-1">
                {update.currentBrands.map((brand, idx) => (
                  <Badge
                    key={idx}
                    variant={update.removals.includes(brand) ? 'destructive' : 'outline'}
                    className="text-[10px]"
                  >
                    {brand}
                    {update.removals.includes(brand) && ' (remove)'}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Proposed Brands (only if changes) */}
            {hasChanges && (
              <div className="mb-2">
                <p className="text-[10px] text-muted-foreground mb-1">Proposed brands:</p>
                <div className="flex flex-wrap gap-1">
                  {update.proposedBrands.map((brand, idx) => (
                    <Badge
                      key={idx}
                      variant={update.additions.includes(brand) ? 'default' : 'outline'}
                      className="text-[10px]"
                    >
                      {brand}
                      {update.additions.includes(brand) && ' (new)'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {update.sources.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1">Sources:</p>
                <div className="flex flex-wrap gap-2">
                  {update.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      {new URL(source).hostname}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryItem = (entry: UpdateHistory, idx: number) => {
    return (
      <div key={idx} className="flex items-start gap-3 py-2">
        <Badge
          variant={entry.changeType === 'addition' ? 'default' : 'destructive'}
          className="text-[10px] mt-0.5"
        >
          {entry.changeType === 'addition' ? '+' : '-'}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">{entry.genericName}</span>
            <span className="text-muted-foreground mx-1">•</span>
            <span className={entry.changeType === 'addition' ? 'text-green-600' : 'text-red-600'}>
              {entry.brandName}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(entry.date), 'dd MMM yyyy, h:mm a')}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Medication Database Updates</DialogTitle>
          <DialogDescription>
            Check for and apply brand name updates from Australian pharmaceutical databases
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="updates" className="mt-4">
          <TabsList>
            <TabsTrigger value="updates" className="text-xs">
              Updates
              {checkResult && checkResult.totalChanges > 0 && (
                <Badge variant="default" className="ml-2 text-[10px]">
                  {checkResult.totalChanges}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
              {updateHistory.length > 0 && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {updateHistory.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Updates Tab */}
          <TabsContent value="updates" className="mt-4">
            {/* Status Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {lastCheckDate
                      ? `Last checked: ${format(lastCheckDate, 'dd MMM yyyy, h:mm a')}`
                      : 'Never checked for updates'}
                  </p>
                  {checkResult && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Check completed in {(checkResult.checkDuration / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleCheckForUpdates}
                  disabled={isChecking}
                  size="sm"
                  className="h-7 text-xs"
                >
                  {isChecking ? 'Checking...' : 'Check for Updates'}
                </Button>
              </div>
            </div>

            {/* Progress Indicator */}
            {isChecking && (
              <div className="bg-white border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Checking medications...</p>
                  <p className="text-xs text-muted-foreground">
                    {checkProgress.current} / {checkProgress.total}
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${(checkProgress.current / checkProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Currently checking: {checkProgress.name}
                </p>
              </div>
            )}

            {/* Results */}
            {checkResult && !isChecking && (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {checkResult.updates.map(renderUpdateItem)}
                </div>
              </ScrollArea>
            )}

            {/* Empty State */}
            {!checkResult && !isChecking && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Check for Updates" to search for brand name changes
                </p>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {updateHistory.length > 0 ? (
                <div className="space-y-1 divide-y">
                  {updateHistory.map(renderHistoryItem)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No update history yet
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-[10px] text-muted-foreground">
              {selectedUpdates.size > 0
                ? `${selectedUpdates.size} medication(s) selected`
                : 'No medications selected'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} size="sm">
                Close
              </Button>
              {checkResult && checkResult.totalChanges > 0 && (
                <Button
                  onClick={handleApplyUpdates}
                  disabled={selectedUpdates.size === 0 || isApplying}
                  size="sm"
                >
                  {isApplying
                    ? 'Applying...'
                    : `Apply Selected Updates (${selectedUpdates.size})`}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
