/**
 * Website Bookings Sync Component
 * Displays unsynced bookings from the website and allows manual sync
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Download, RefreshCw, CheckCircle2, XCircle, AlertCircle, Bug, EyeOff, GitCompare, AlertTriangle, Wand2 } from 'lucide-react';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Checkbox } from '../ui/checkbox';
import { ConfirmDialog } from '../ui/confirm-dialog';
import {
  fetchUnsyncedBookings,
  syncAllWebsiteBookings,
  markBookingAsSynced,
  detectBookingDrift,
  reconcileAllDrift,
  type WebsiteBooking,
  type BookingSyncResult,
  type BookingDriftReport,
  type ReconciliationResult,
} from '@/lib/services/bookingSyncService';
import { diagnoseBookings } from '@/lib/services/diagnosticBookings';

export function WebsiteBookingsSync() {
  const queryClient = useQueryClient();
  const [bookings, setBookings] = useState<WebsiteBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [syncResults, setSyncResults] = useState<BookingSyncResult[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDismissConfirmOpen, setIsDismissConfirmOpen] = useState(false);
  const [driftReport, setDriftReport] = useState<BookingDriftReport | null>(null);
  const [detectingDrift, setDetectingDrift] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResults, setReconcileResults] = useState<ReconciliationResult[] | null>(null);
  const [isReconcileConfirmOpen, setIsReconcileConfirmOpen] = useState(false);

  // Fetch unsynced bookings on mount
  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const data = await fetchUnsyncedBookings();
      setBookings(data);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResults([]);
    try {
      const result = await syncAllWebsiteBookings();
      setSyncResults(result.results);
      setLastSync(new Date());

      // Remove successfully synced bookings from local state immediately
      const successfulBookingIds = result.results
        .filter(r => r.success)
        .map(r => r.bookingId);

      setBookings(prevBookings =>
        prevBookings.filter(b => !successfulBookingIds.includes(b.id))
      );

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const handleDiagnose = async () => {
    console.log('Running booking sync diagnostic...');
    await diagnoseBookings();
    console.log('Check the browser console for detailed results');
  };

  const handleDetectDrift = async () => {
    setDetectingDrift(true);
    setDriftReport(null);
    setReconcileResults(null);
    try {
      const report = await detectBookingDrift();
      setDriftReport(report);
    } catch (error) {
      console.error('Drift detection failed:', error);
      setDriftReport({
        totalBookingsChecked: 0,
        matchedEventsCount: 0,
        driftRows: [],
        errors: [error instanceof Error ? error.message : String(error)],
        generatedAt: new Date().toISOString(),
      });
    } finally {
      setDetectingDrift(false);
    }
  };

  // Rows the gate will actually act on (rescheduled_count > 0). Skipped rows count
  // toward the total but the button label and confirm copy reflect only the actionable.
  const reconcilableRows = driftReport
    ? driftReport.driftRows.filter((r) => r.rescheduledCount > 0)
    : [];

  const handleApplyFixes = () => {
    if (reconcilableRows.length === 0) return;
    setIsReconcileConfirmOpen(true);
  };

  const confirmApplyFixes = async () => {
    if (!driftReport) return;
    setIsReconcileConfirmOpen(false);
    setReconciling(true);
    setReconcileResults(null);
    try {
      const summary = await reconcileAllDrift(driftReport.driftRows);
      setReconcileResults(summary.results);

      // Refresh events queries so the dashboard reflects the new dates
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingBookings'] });

      // Auto-rerun the drift detector so Captain sees the table empty (or shrink) on success
      try {
        const freshReport = await detectBookingDrift();
        setDriftReport(freshReport);
      } catch (e) {
        console.error('Post-apply drift recheck failed:', e);
      }
    } catch (error) {
      console.error('Apply fixes failed:', error);
    } finally {
      setReconciling(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map(b => b.id)));
    }
  };

  const handleDismiss = () => {
    setIsDismissConfirmOpen(true);
  };

  const confirmDismiss = async () => {
    setDismissing(true);
    setIsDismissConfirmOpen(false);
    try {
      for (const id of selectedIds) {
        await markBookingAsSynced(id);
      }
      setBookings(prev => prev.filter(b => !selectedIds.has(b.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to dismiss bookings:', error);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {bookings.length > 0 && (
            <Badge variant="default" className="bg-blue-500 text-[10px] h-5">
              {bookings.length} new
            </Badge>
          )}
          {lastSync && (
            <span className="text-[10px] text-muted-foreground">
              Synced: {lastSync.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiagnose}
            className="h-7 px-2"
            title="Run diagnostic to check Supabase connection"
          >
            <Bug className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetectDrift}
            disabled={detectingDrift}
            className="h-7 text-xs"
            title="Compare PBS Admin event dates against current Supabase consultation dates"
          >
            <GitCompare className={`h-3 w-3 mr-1 ${detectingDrift ? 'animate-pulse' : ''}`} />
            {detectingDrift ? 'Checking...' : 'Detect Drift'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadBookings}
            disabled={loading}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {bookings.length > 0 && (
            <>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                  disabled={syncing || dismissing}
                  className="h-7 text-xs text-muted-foreground"
                  title="Dismiss selected - mark as already synced"
                >
                  <EyeOff className="h-3 w-3 mr-1" />
                  {dismissing ? 'Dismissing...' : `Dismiss ${selectedIds.size}`}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSync}
                disabled={syncing || dismissing}
                className="h-7 text-xs"
              >
                <Download className={`h-3 w-3 mr-1 ${syncing ? 'animate-bounce' : ''}`} />
                {syncing ? 'Syncing...' : `Import ${bookings.length}`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sync results */}
      {syncResults.length > 0 && (
        <div className="space-y-1 p-2 bg-muted/50 rounded-md">
          <h4 className="text-[10px] font-semibold">Sync Results</h4>
          {syncResults.map((result, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-[11px]">
              {result.success ? (
                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
              )}
              <span className="leading-tight">
                {result.success ? (
                  <>
                    Imported <strong>{result.clientName}</strong> ({result.petName})
                    {result.isNewClient && <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">New</Badge>}
                  </>
                ) : (
                  <>
                    Failed: {result.clientName} - {result.error}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drift results */}
      {driftReport && (
        <div className="space-y-1.5 p-2 bg-muted/50 rounded-md">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold flex items-center gap-1">
              <GitCompare className="h-3 w-3" />
              Drift Report
            </h4>
            <div className="flex items-center gap-1.5">
              {reconcilableRows.length > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleApplyFixes}
                  disabled={reconciling}
                  className="h-6 text-[10px] px-2"
                  title="Update PBS Admin event dates to match Supabase for rescheduled bookings"
                >
                  <Wand2 className={`h-3 w-3 mr-1 ${reconciling ? 'animate-pulse' : ''}`} />
                  {reconciling ? 'Applying...' : `Apply Fixes (${reconcilableRows.length})`}
                </Button>
              )}
              <button
                onClick={() => { setDriftReport(null); setReconcileResults(null); }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Checked {driftReport.totalBookingsChecked} bookings ·
            matched {driftReport.matchedEventsCount} local events ·
            <strong className={driftReport.driftRows.length > 0 ? 'text-amber-600 ml-1' : 'text-green-600 ml-1'}>
              {driftReport.driftRows.length} drifted
            </strong>
            {driftReport.errors.length > 0 && (
              <span className="text-red-600 ml-1">· {driftReport.errors.length} error(s)</span>
            )}
          </div>

          {driftReport.driftRows.length === 0 && driftReport.errors.length === 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-green-600">
              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
              No drift detected. PBS Admin event dates match Supabase consultation dates.
            </div>
          )}

          {driftReport.driftRows.length > 0 && (
            <div className="border rounded-md bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-7 text-[10px] py-1">Booking</TableHead>
                    <TableHead className="h-7 text-[10px] py-1">Client / Pet</TableHead>
                    <TableHead className="h-7 text-[10px] py-1">PBS Admin</TableHead>
                    <TableHead className="h-7 text-[10px] py-1">Supabase</TableHead>
                    <TableHead className="h-7 text-[10px] py-1" title="Number of reschedules recorded on the Supabase booking. Apply Fixes only acts on rows where this is > 0.">Resched</TableHead>
                    <TableHead className="h-7 text-[10px] py-1">Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driftReport.driftRows.map((row) => (
                    <TableRow key={row.eventId} className="h-9">
                      <TableCell className="py-1 text-[10px]">
                        <div className="font-mono">{row.bookingReference}</div>
                        <div className="text-muted-foreground">
                          event {row.eventId} · {row.bookingStatus}
                        </div>
                      </TableCell>
                      <TableCell className="py-1 text-[10px]">
                        <div>{row.customerName}</div>
                        <div className="text-muted-foreground">{row.petName}</div>
                      </TableCell>
                      <TableCell className="py-1 text-[10px] text-amber-700">
                        {row.pbsAdminDateFormatted}
                      </TableCell>
                      <TableCell className="py-1 text-[10px] text-green-700">
                        {row.supabaseDateFormatted}
                      </TableCell>
                      <TableCell className="py-1">
                        {row.rescheduledCount > 0 ? (
                          <Badge variant="default" className="text-[9px] h-4 px-1" title="Will be reconciled by Apply Fixes">
                            {row.rescheduledCount}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground" title="rescheduled_count=0 — gate prevents auto-reconcile; investigate manually">
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-1">
                        {row.syncedToAdmin === true ? (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1" title="Lying flag — claims synced but data is stale">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            true
                          </Badge>
                        ) : row.syncedToAdmin === false ? (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1">
                            false
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                            null
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {driftReport.errors.length > 0 && (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-red-600 font-semibold">
                Errors ({driftReport.errors.length})
              </summary>
              <ul className="mt-1 ml-4 list-disc text-red-700">
                {driftReport.errors.map((err, idx) => (
                  <li key={idx} className="leading-tight">{err}</li>
                ))}
              </ul>
            </details>
          )}

          {reconcileResults && reconcileResults.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-border space-y-1">
              <h5 className="text-[10px] font-semibold flex items-center gap-1">
                <Wand2 className="h-3 w-3" />
                Apply Results
              </h5>
              {reconcileResults.map((r, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                  {r.status === 'reconciled' ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                  ) : r.status === 'error' ? (
                    <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="leading-tight">
                    {r.status === 'reconciled' && (
                      <>
                        Reconciled <strong>{r.bookingReference}</strong> ({r.customerName}):
                        <span className="text-amber-700"> {r.beforeDateFormatted}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="text-green-700">{r.afterDateFormatted}</span>
                      </>
                    )}
                    {r.status === 'skipped-no-reschedule' && (
                      <>
                        Skipped <strong>{r.bookingReference}</strong> — rescheduled_count=0
                      </>
                    )}
                    {r.status === 'error' && (
                      <>
                        Failed <strong>{r.bookingReference}</strong>: {r.error}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bookings table */}
      {loading ? (
        <div className="flex items-center justify-center py-4 gap-2">
          <LoadingSpinner size="sm" className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading bookings...</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          No new bookings to import
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-7 py-1 w-8">
                  <Checkbox
                    checked={bookings.length > 0 && selectedIds.size === bookings.length}
                    onCheckedChange={toggleSelectAll}
                    className="h-3.5 w-3.5"
                  />
                </TableHead>
                <TableHead className="h-7 text-[11px] py-1">Client</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Pet</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Service</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Appointment</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id} className="h-12">
                  <TableCell className="py-1 w-8">
                    <Checkbox
                      checked={selectedIds.has(booking.id)}
                      onCheckedChange={() => toggleSelection(booking.id)}
                      className="h-3.5 w-3.5"
                    />
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="text-[11px] leading-tight">
                      <div className="font-medium">{booking.customer_name}</div>
                      <div className="text-muted-foreground truncate max-w-[120px]">
                        {booking.customer_email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="text-[11px] leading-tight">
                      <div>{booking.pet_name}</div>
                      {booking.pet_species && (
                        <div className="text-muted-foreground">
                          {booking.pet_species}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="text-[11px] leading-tight">
                      <div>{booking.service_type}</div>
                      <div className="text-muted-foreground">
                        {booking.service_delivery}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="text-[11px] leading-tight">
                      <div>{formatDate(booking.consultation_date)}</div>
                      <div className="text-muted-foreground">
                        {formatTime(booking.consultation_time)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="flex flex-col gap-0.5">
                      <Badge
                        variant={
                          booking.payment_status === 'completed'
                            ? 'default'
                            : booking.payment_status === 'pending'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-[9px] h-4 px-1.5"
                      >
                        {booking.payment_status}
                      </Badge>
                      {booking.referral_required && !booking.referral_file_path && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                          Referral
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dismiss Confirmation Dialog */}
      <ConfirmDialog
        open={isDismissConfirmOpen}
        onOpenChange={setIsDismissConfirmOpen}
        title="Dismiss Bookings"
        description={`Dismiss ${selectedIds.size} booking(s)? They will be marked as synced in Supabase and won't appear in this list again.`}
        confirmText="Dismiss Selected"
        cancelText="Cancel"
        onConfirm={confirmDismiss}
      />

      {/* Apply Fixes Confirmation Dialog */}
      <ConfirmDialog
        open={isReconcileConfirmOpen}
        onOpenChange={setIsReconcileConfirmOpen}
        title="Apply Reschedule Reconciliation"
        description={`This will update Event.date on ${reconcilableRows.length} PBS Admin event(s) to match Supabase's current consultation time, and create an audit-trail Note event for each. Only rows with rescheduled_count > 0 will be touched. Rows with rescheduled_count = 0 will be skipped to protect manual edits. Proceed?`}
        confirmText={`Apply ${reconcilableRows.length} Fix(es)`}
        cancelText="Cancel"
        onConfirm={confirmApplyFixes}
      />
    </div>
  );
}
