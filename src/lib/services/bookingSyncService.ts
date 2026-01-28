/**
 * Booking Sync Service
 * Syncs website bookings from Supabase to PBS_Admin local database
 */

import { supabase } from '../supabaseClient';
import { withTransaction } from '../db';
import { logger } from '../utils/logger';
import {
  createClient,
  updateClient,
  findClientByEmailOrMobile,
} from './clientService';
import {
  createPet,
  findPetByNameAndClient,
} from './petService';
import {
  createEvent,
} from './eventService';
import { onEventCreated } from '../automation/engine';
import type { Client, Pet } from '../types';
import { formatISO, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { invoke } from '@tauri-apps/api/core';

const TIMEZONE = 'Australia/Melbourne';

/**
 * Website booking record from Supabase
 */
export interface WebsiteBooking {
  id: string;
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  pet_name: string;
  pet_species: string | null;
  pet_breed: string | null;
  service_type: 'VBC' | 'BAAC';
  service_delivery: 'Zoom' | 'Home Visit';
  customer_postcode: string | null;
  base_price: number;
  travel_charge: number;
  total_price: number;
  currency: string;
  booking_date: string;
  consultation_date: string; // YYYY-MM-DD
  consultation_time: string; // HH:mm
  timezone: string;
  zoom_link: string | null;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  stripe_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  referral_required: boolean;
  referral_file_path: string | null;
  referral_file_name: string | null;
  problem_description: string | null;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
  synced_to_admin: boolean | null; // Flag to track if synced
}

/**
 * Result of a booking sync operation
 */
export interface BookingSyncResult {
  success: boolean;
  bookingId: string;
  bookingReference: string;
  clientId?: number;
  clientName: string;
  petId?: number;
  petName: string;
  noteEventId?: number;
  bookingEventId?: number;
  isNewClient: boolean;
  referralDownloaded?: boolean;
  referralLocalPath?: string;
  error?: string;
}

/**
 * Download referral file from Supabase Storage to client folder
 * Uses signed URL to access the file and Tauri's download_file command
 */
export async function downloadReferralFile(
  booking: WebsiteBooking,
  clientFolderPath: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  if (!booking.referral_file_path) {
    return { success: false, error: 'No referral file path' };
  }

  if (!clientFolderPath) {
    return { success: false, error: 'Client folder not set' };
  }

  try {
    // Create a signed URL for the referral file (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('referrals')
      .createSignedUrl(booking.referral_file_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      logger.error('Failed to create signed URL:', signedUrlError);
      return {
        success: false,
        error: signedUrlError?.message || 'Failed to create signed URL',
      };
    }

    // Determine the local filename
    // Format: referral_{booking_reference}_{original_extension}
    const originalExtension = booking.referral_file_name?.split('.').pop() || 'pdf';
    const consultationDateFormatted = format(new Date(booking.consultation_date), 'yyyyMMdd');
    const localFileName = `referral_${booking.booking_reference}_${consultationDateFormatted}.${originalExtension}`;

    // Normalize paths for Windows
    const normalizedFolderPath = clientFolderPath.replace(/\//g, '\\');
    const localFilePath = `${normalizedFolderPath}\\${localFileName}`;

    // Download the file using Tauri command
    await invoke<string>('download_file', {
      url: signedUrlData.signedUrl,
      filePath: localFilePath,
    });

    logger.info(`Referral file downloaded to: ${localFilePath}`);

    return {
      success: true,
      localPath: localFilePath,
    };
  } catch (error) {
    logger.error('Failed to download referral file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error downloading referral',
    };
  }
}

/**
 * Update booking status in Supabase (bidirectional sync)
 * Called when consultation is marked as completed or cancelled in PBS Admin
 */
export async function updateBookingStatus(
  bookingId: string,
  status: 'completed' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      logger.error('Failed to update booking status:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    logger.info(`Booking ${bookingId} status updated to: ${status}`);
    return { success: true };
  } catch (error) {
    logger.error('Error updating booking status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find booking by reference in Supabase
 * Used to get booking ID for status updates
 */
export async function findBookingByReference(
  bookingReference: string
): Promise<WebsiteBooking | null> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_reference', bookingReference)
      .single();

    if (error) {
      logger.error('Failed to find booking by reference:', error);
      return null;
    }

    return data as WebsiteBooking;
  } catch (error) {
    logger.error('Error finding booking by reference:', error);
    return null;
  }
}

/**
 * Find existing client by email (primary) or mobile (fallback)
 * Uses efficient SQL-based lookup instead of loading all clients
 */
async function findExistingClient(
  email: string,
  mobile: string | null
): Promise<Client | null> {
  return findClientByEmailOrMobile(email, mobile);
}

/**
 * Split customer name into first and last name
 */
function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

/**
 * Find existing pet by name for a client
 * Uses efficient SQL-based lookup instead of loading all pets
 */
async function findExistingPet(
  clientId: number,
  petName: string
): Promise<Pet | null> {
  return findPetByNameAndClient(petName, clientId);
}

/**
 * Import a single website booking into PBS_Admin
 * Uses database transaction to ensure atomic operation
 */
export async function importWebsiteBooking(
  booking: WebsiteBooking
): Promise<BookingSyncResult> {
  try {
    const { firstName, lastName } = splitCustomerName(booking.customer_name);

    // Check for existing client before transaction (read operation)
    const existingClient = await findExistingClient(
      booking.customer_email,
      booking.customer_phone
    );
    const isNewClient = !existingClient;

    // Wrap all write operations in a transaction
    const result = await withTransaction(async () => {
      let client: Client;

      // 1. Create or update client
      if (existingClient) {
        // Update existing client with any new information
        client = await updateClient(existingClient.clientId, {
          firstName: existingClient.firstName,
          lastName: existingClient.lastName,
          email: booking.customer_email, // Update email in case it changed
          mobile: booking.customer_phone || existingClient.mobile,
          streetAddress: existingClient.streetAddress || '',
          city: existingClient.city || '',
          state: existingClient.state || 'VIC',
          postcode: booking.customer_postcode || existingClient.postcode || '',
          stripeCustomerId: booking.stripe_customer_id || existingClient.stripeCustomerId || undefined,
          folderPath: existingClient.folderPath || undefined,
          notes: existingClient.notes || undefined,
        });
      } else {
        // Create new client
        client = await createClient({
          firstName,
          lastName,
          email: booking.customer_email,
          mobile: booking.customer_phone || '',
          streetAddress: '',
          city: '',
          state: 'VIC',
          postcode: booking.customer_postcode || '',
          stripeCustomerId: booking.stripe_customer_id || undefined,
          folderPath: undefined,
          notes: `Imported from website booking ${booking.booking_reference}\n${booking.problem_description || ''}`.trim(),
        });
      }

      // 2. Find or create pet
      let pet = await findExistingPet(client.clientId, booking.pet_name);

      if (!pet) {
        pet = await createPet({
          clientId: client.clientId,
          name: booking.pet_name,
          species: booking.pet_species || '',
          breed: booking.pet_breed || '',
          sex: undefined,
          dateOfBirth: undefined,
          notes: booking.problem_description || undefined,
        });
      }

      // 3. Create "Note" event for new clients only
      let noteEventId: number | undefined;
      if (isNewClient) {
        const noteEvent = await createEvent({
          clientId: client.clientId,
          eventType: 'Note',
          date: booking.booking_date, // When client was created on website
          notes: '<p>Client created via website booking</p>',
          calendlyEventUri: undefined,
          calendlyStatus: undefined,
          invoiceFilePath: undefined,
          hostedInvoiceUrl: undefined,
          parentEventId: undefined,
        });
        noteEventId = noteEvent.eventId;
      }

      // 4. Create "Booking" event
      // Handle time with or without seconds (HH:mm or HH:mm:ss)
      const timeWithSeconds = booking.consultation_time.includes(':')
        ? (booking.consultation_time.split(':').length === 3
            ? booking.consultation_time
            : `${booking.consultation_time}:00`)
        : `${booking.consultation_time}:00:00`;

      const consultationDateTime = `${booking.consultation_date}T${timeWithSeconds}`;
      const zonedDate = toZonedTime(new Date(consultationDateTime), TIMEZONE);
      const isoDate = formatISO(zonedDate);

      const bookingNotes = `
        <h2>Website Booking Details</h2>
        <p><strong>Booking Reference:</strong> ${booking.booking_reference}</p>
        <p><strong>Service:</strong> ${booking.service_type} (${booking.service_delivery})</p>
        <p><strong>Pet:</strong> ${booking.pet_name}${booking.pet_species ? ` (${booking.pet_species})` : ''}</p>

        ${booking.zoom_link ? `<p><strong>Zoom Link:</strong> <a href="${booking.zoom_link}" target="_blank">${booking.zoom_link}</a></p>` : ''}
        ${booking.customer_postcode ? `<p><strong>Postcode:</strong> ${booking.customer_postcode}</p>` : ''}

        <h3>Pricing</h3>
        <p><strong>Base Price:</strong> $${booking.base_price.toFixed(2)}</p>
        ${booking.travel_charge > 0 ? `<p><strong>Travel Charge:</strong> $${booking.travel_charge.toFixed(2)}</p>` : ''}
        <p><strong>Total:</strong> $${booking.total_price.toFixed(2)} ${booking.currency}</p>
        <p><strong>Payment Status:</strong> ${booking.payment_status}</p>

        ${booking.referral_required ? `
          <h3>Referral</h3>
          ${booking.referral_file_path
            ? `<p><strong>Referral File:</strong> ${booking.referral_file_name || 'Uploaded'}</p>`
            : `<p><strong>Status:</strong> Pending - Client will submit later</p>`
          }
        ` : ''}

        ${booking.problem_description ? `
          <h3>Problem Description</h3>
          <p>${booking.problem_description}</p>
        ` : ''}

        ${booking.notes ? `
          <h3>Additional Notes</h3>
          <p>${booking.notes}</p>
        ` : ''}

        <p><em>Stripe Session: ${booking.stripe_session_id || 'N/A'}</em></p>
      `.trim();

      const bookingEvent = await createEvent({
        clientId: client.clientId,
        eventType: 'Booking',
        date: isoDate,
        notes: bookingNotes,
        calendlyEventUri: undefined,
        calendlyStatus: undefined,
        invoiceFilePath: undefined,
        hostedInvoiceUrl: booking.stripe_session_id
          ? `https://dashboard.stripe.com/payments/${booking.stripe_payment_intent_id}`
          : undefined,
        parentEventId: undefined,
      });

      return { client, pet, noteEventId, bookingEvent };
    });

    // Trigger automation outside of transaction (it creates additional records)
    // This will auto-create the questionnaire check task
    await onEventCreated(result.bookingEvent);

    // Download referral file if available and client has folder
    let referralDownloaded = false;
    let referralLocalPath: string | undefined;

    if (booking.referral_file_path && result.client.folderPath) {
      const downloadResult = await downloadReferralFile(booking, result.client.folderPath);
      referralDownloaded = downloadResult.success;
      referralLocalPath = downloadResult.localPath;

      if (!downloadResult.success) {
        logger.warn(`Referral download failed for ${booking.booking_reference}: ${downloadResult.error}`);
      }
    }

    return {
      success: true,
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      clientId: result.client.clientId,
      clientName: booking.customer_name,
      petId: result.pet.petId,
      petName: booking.pet_name,
      noteEventId: result.noteEventId,
      bookingEventId: result.bookingEvent.eventId,
      isNewClient,
      referralDownloaded,
      referralLocalPath,
    };

  } catch (error) {
    logger.error('Failed to import booking:', error);
    return {
      success: false,
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      clientName: booking.customer_name,
      petName: booking.pet_name,
      isNewClient: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch unsynced bookings from Supabase
 * Note: If synced_to_admin column doesn't exist, this will fetch all confirmed bookings
 */
export async function fetchUnsyncedBookings(): Promise<WebsiteBooking[]> {
  try {
    // First, try to fetch with synced_to_admin filter
    const queryWithSync = supabase
      .from('bookings')
      .select('*')
      .eq('status', 'confirmed')
      .or('synced_to_admin.is.null,synced_to_admin.eq.false')
      .order('created_at', { ascending: true });

    const { data: dataWithSync, error: errorWithSync } = await queryWithSync;

    // If column doesn't exist (error code 42703), retry without the filter
    if (errorWithSync && errorWithSync.code === '42703') {
      logger.debug('synced_to_admin column does not exist, fetching all confirmed bookings');

      const queryWithoutSync = supabase
        .from('bookings')
        .select('*')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true });

      const { data: dataWithoutSync, error: errorWithoutSync } = await queryWithoutSync;

      if (errorWithoutSync) {
        logger.error('Supabase query error:', errorWithoutSync);
        return [];
      }

      return (dataWithoutSync || []) as WebsiteBooking[];
    }

    // If different error, log it and return empty
    if (errorWithSync) {
      logger.error('Supabase query error:', errorWithSync);
      return [];
    }

    return (dataWithSync || []) as WebsiteBooking[];
  } catch (error) {
    logger.error('Failed to fetch bookings from Supabase:', error);
    return [];
  }
}

/**
 * Mark a booking as synced in Supabase
 * Note: If synced_to_admin column doesn't exist, this returns true without error
 */
export async function markBookingAsSynced(bookingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ synced_to_admin: true })
      .eq('id', bookingId);

    if (error) {
      // If column doesn't exist (error code 42703), just return true
      // This allows the sync to work even without the column
      if (error.code === '42703') {
        logger.debug('synced_to_admin column does not exist, skipping sync marker');
        return true;
      }

      logger.error('Failed to mark booking as synced:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error marking booking as synced:', error);
    return false;
  }
}

/**
 * Sync all unsynced website bookings
 */
export async function syncAllWebsiteBookings(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: BookingSyncResult[];
}> {
  const bookings = await fetchUnsyncedBookings();
  const results: BookingSyncResult[] = [];

  let successful = 0;
  let failed = 0;

  for (const booking of bookings) {
    const result = await importWebsiteBooking(booking);
    results.push(result);

    if (result.success) {
      successful++;
      // Mark as synced in Supabase
      await markBookingAsSynced(booking.id);
    } else {
      failed++;
    }
  }

  return {
    total: bookings.length,
    successful,
    failed,
    results,
  };
}

/**
 * Extract booking reference from event notes HTML
 * Looks for pattern: <strong>Booking Reference:</strong> PBS-XXX
 */
function extractBookingReference(notesHtml: string | null | undefined): string | null {
  if (!notesHtml) return null;

  // Match "Booking Reference:" followed by the reference (PBS-XXX format or similar)
  const match = notesHtml.match(/Booking Reference:<\/strong>\s*([A-Z]+-\d+)/i);
  return match ? match[1] : null;
}

/**
 * Mark a consultation as complete in Supabase
 * Finds the booking by reference extracted from the client's Booking events
 * Called when a report is sent or consultation is marked complete
 */
export async function markConsultationComplete(
  clientId: number,
  consultationDate?: string
): Promise<{ success: boolean; bookingReference?: string; error?: string }> {
  try {
    // Import eventService here to avoid circular dependency
    const { getEventsByClientId } = await import('./eventService');

    // Get all Booking events for this client
    const events = await getEventsByClientId(clientId);
    const bookingEvents = events.filter(e => e.eventType === 'Booking');

    if (bookingEvents.length === 0) {
      return {
        success: false,
        error: 'No booking events found for this client',
      };
    }

    // Find the matching booking event
    let targetBookingEvent = bookingEvents[0]; // Default to most recent

    if (consultationDate) {
      // Find booking closest to the consultation date
      const consultationDateObj = new Date(consultationDate);
      let closestEvent = bookingEvents[0];
      let closestDiff = Math.abs(new Date(closestEvent.date).getTime() - consultationDateObj.getTime());

      for (const event of bookingEvents) {
        const diff = Math.abs(new Date(event.date).getTime() - consultationDateObj.getTime());
        if (diff < closestDiff) {
          closestEvent = event;
          closestDiff = diff;
        }
      }
      targetBookingEvent = closestEvent;
    }

    // Extract booking reference from notes
    const bookingReference = extractBookingReference(targetBookingEvent.notes);

    if (!bookingReference) {
      logger.warn('No booking reference found in event notes');
      return {
        success: false,
        error: 'No booking reference found in event notes',
      };
    }

    // Find booking in Supabase by reference
    const booking = await findBookingByReference(bookingReference);

    if (!booking) {
      logger.warn(`Booking not found in Supabase: ${bookingReference}`);
      return {
        success: false,
        bookingReference,
        error: 'Booking not found in Supabase',
      };
    }

    // Update booking status to completed
    const result = await updateBookingStatus(booking.id, 'completed');

    if (result.success) {
      logger.info(`Consultation marked complete: ${bookingReference}`);
    }

    return {
      success: result.success,
      bookingReference,
      error: result.error,
    };
  } catch (error) {
    logger.error('Error marking consultation complete:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
