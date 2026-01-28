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
import { Download, RefreshCw, CheckCircle2, XCircle, AlertCircle, Bug } from 'lucide-react';
import { LoadingSpinner } from '../ui/loading-spinner';
import {
  fetchUnsyncedBookings,
  syncAllWebsiteBookings,
  type WebsiteBooking,
  type BookingSyncResult,
} from '@/lib/services/bookingSyncService';
import { diagnoseBookings } from '@/lib/services/diagnosticBookings';

export function WebsiteBookingsSync() {
  const queryClient = useQueryClient();
  const [bookings, setBookings] = useState<WebsiteBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<BookingSyncResult[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

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
            onClick={loadBookings}
            disabled={loading}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {bookings.length > 0 && (
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-7 text-xs"
            >
              <Download className={`h-3 w-3 mr-1 ${syncing ? 'animate-bounce' : ''}`} />
              {syncing ? 'Syncing...' : `Import ${bookings.length}`}
            </Button>
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
    </div>
  );
}
