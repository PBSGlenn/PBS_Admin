/**
 * Booking Sync Service
 * Syncs website bookings from Supabase to PBS_Admin local database
 */

import { supabase } from '../supabaseClient';
import {
  getAllClients,
  createClient,
  updateClient,
} from './clientService';
import {
  getAllPets,
  createPet,
} from './petService';
import {
  createEvent,
} from './eventService';
import { onEventCreated } from '../automation/engine';
import type { Client, Pet } from '../types';
import { formatISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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
  error?: string;
}

/**
 * Find existing client by email (primary) or mobile (fallback)
 */
async function findExistingClient(
  email: string,
  mobile: string | null
): Promise<Client | null> {
  const clients = await getAllClients();

  // Try to match by email first (most reliable)
  if (email) {
    const byEmail = clients.find(c =>
      c.email.toLowerCase() === email.toLowerCase()
    );
    if (byEmail) return byEmail;
  }

  // Fallback to mobile if provided
  if (mobile) {
    // Remove all non-digit characters for comparison
    const cleanMobile = mobile.replace(/\D/g, '');
    const byMobile = clients.find(c => {
      if (!c.mobile) return false;
      const cleanClientMobile = c.mobile.replace(/\D/g, '');
      return cleanClientMobile === cleanMobile;
    });
    if (byMobile) return byMobile;
  }

  return null;
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
 */
async function findExistingPet(
  clientId: number,
  petName: string
): Promise<Pet | null> {
  const pets = await getAllPets();
  const clientPets = pets.filter(p => p.clientId === clientId);

  // Case-insensitive match by name
  return clientPets.find(p =>
    p.name.toLowerCase() === petName.toLowerCase()
  ) || null;
}

/**
 * Import a single website booking into PBS_Admin
 */
export async function importWebsiteBooking(
  booking: WebsiteBooking
): Promise<BookingSyncResult> {
  try {
    const { firstName, lastName } = splitCustomerName(booking.customer_name);

    // 1. Find or create client
    let client = await findExistingClient(
      booking.customer_email,
      booking.customer_phone
    );

    const isNewClient = !client;

    if (client) {
      // Update existing client with any new information
      const updatedClient = await updateClient(client.clientId, {
        firstName: client.firstName,
        lastName: client.lastName,
        email: booking.customer_email, // Update email in case it changed
        mobile: booking.customer_phone || client.mobile,
        streetAddress: client.streetAddress || '',
        city: client.city || '',
        state: client.state || 'VIC',
        postcode: booking.customer_postcode || client.postcode || '',
        stripeCustomerId: booking.stripe_customer_id || client.stripeCustomerId || undefined,
        folderPath: client.folderPath || undefined,
        notes: client.notes || undefined,
      });
      client = updatedClient;
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

    // Trigger automation for the newly created Booking event
    // This will auto-create the questionnaire check task
    await onEventCreated(bookingEvent);

    return {
      success: true,
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      clientId: client.clientId,
      clientName: booking.customer_name,
      petId: pet.petId,
      petName: booking.pet_name,
      noteEventId,
      bookingEventId: bookingEvent.eventId,
      isNewClient,
    };

  } catch (error) {
    console.error('Failed to import booking:', error);
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
      console.log('synced_to_admin column does not exist, fetching all confirmed bookings');

      const queryWithoutSync = supabase
        .from('bookings')
        .select('*')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true });

      const { data: dataWithoutSync, error: errorWithoutSync } = await queryWithoutSync;

      if (errorWithoutSync) {
        console.error('Supabase query error:', errorWithoutSync);
        return [];
      }

      return (dataWithoutSync || []) as WebsiteBooking[];
    }

    // If different error, log it and return empty
    if (errorWithSync) {
      console.error('Supabase query error:', errorWithSync);
      return [];
    }

    return (dataWithSync || []) as WebsiteBooking[];
  } catch (error) {
    console.error('Failed to fetch bookings from Supabase:', error);
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
        console.log('synced_to_admin column does not exist, skipping sync marker');
        return true;
      }

      console.error('Failed to mark booking as synced:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking booking as synced:', error);
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
