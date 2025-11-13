/**
 * Diagnostic script to check Supabase bookings
 * Run this to debug booking sync issues
 */

import { supabase } from '../supabaseClient';

export async function diagnoseBookings() {
  console.log('=== BOOKING SYNC DIAGNOSTIC ===\n');

  // 0. Check Supabase connection and configuration
  console.log('0. Checking Supabase Configuration...');
  console.log(`Supabase URL: ${import.meta.env.VITE_SUPABASE_URL}`);
  console.log(`Anon Key: ${import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20)}...`);
  console.log('');

  // 1. Check all bookings (no filters)
  console.log('1. Fetching ALL bookings from Supabase...');
  const { data: allBookings, error: allError } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allError) {
    console.error('❌ Error fetching all bookings:', allError);
    console.error('Error details:', JSON.stringify(allError, null, 2));

    // Try to check if table exists by querying with limit 0
    console.log('\nTrying to verify table exists...');
    const { error: tableError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true });

    if (tableError) {
      console.error('❌ Table access error:', tableError);
      console.error('This might mean:');
      console.error('  1. The "bookings" table does not exist');
      console.error('  2. The anon key does not have permission to access it');
      console.error('  3. Row Level Security (RLS) is blocking access');
    }
    return;
  }

  console.log(`✅ Found ${allBookings?.length || 0} total bookings (showing last 10)`);
  console.log('\nBooking details:');
  allBookings?.forEach((booking, idx) => {
    console.log(`\n--- Booking ${idx + 1} ---`);
    console.log(`ID: ${booking.id}`);
    console.log(`Reference: ${booking.booking_reference}`);
    console.log(`Customer: ${booking.customer_name}`);
    console.log(`Email: ${booking.customer_email}`);
    console.log(`Status: ${booking.status}`);
    console.log(`Payment Status: ${booking.payment_status}`);
    console.log(`Synced to Admin: ${booking.synced_to_admin}`);
    console.log(`Created: ${booking.created_at}`);
    console.log(`Consultation Date: ${booking.consultation_date}`);
    console.log(`Consultation Time: ${booking.consultation_time}`);
  });

  // 2. Check confirmed bookings only
  console.log('\n\n2. Fetching CONFIRMED bookings...');
  const { data: confirmedBookings, error: confirmedError } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false });

  if (confirmedError) {
    console.error('❌ Error fetching confirmed bookings:', confirmedError);
  } else {
    console.log(`✅ Found ${confirmedBookings?.length || 0} confirmed bookings`);
  }

  // 3. Check unsynced bookings (the actual filter used by the app)
  console.log('\n\n3. Fetching UNSYNCED bookings (what the app should show)...');
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true });

  try {
    query = query.or('synced_to_admin.is.null,synced_to_admin.eq.false');
  } catch (e) {
    console.log('⚠️  synced_to_admin column may not exist');
  }

  const { data: unsyncedBookings, error: unsyncedError } = await query;

  if (unsyncedError) {
    console.error('❌ Error fetching unsynced bookings:', unsyncedError);
    console.error('Error details:', JSON.stringify(unsyncedError, null, 2));
    console.log('This error is likely due to the "synced_to_admin" column not existing in the table.');
  } else {
    console.log(`✅ Found ${unsyncedBookings?.length || 0} unsynced bookings`);
    unsyncedBookings?.forEach((booking, idx) => {
      console.log(`  ${idx + 1}. ${booking.booking_reference} - ${booking.customer_name} (${booking.customer_email})`);
    });
  }

  // 4. Double-check by listing recent bookings with minimal filters
  console.log('\n\n4. Trying simple query (status only, no synced filter)...');
  const { data: simpleBookings, error: simpleError } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(5);

  if (simpleError) {
    console.error('❌ Simple query error:', simpleError);
  } else {
    console.log(`✅ Found ${simpleBookings?.length || 0} confirmed bookings (simple query)`);
    if (simpleBookings && simpleBookings.length > 0) {
      console.log('Recent confirmed bookings:');
      simpleBookings.forEach((booking: any, idx: number) => {
        console.log(`  ${idx + 1}. ${booking.booking_reference} - ${booking.customer_name}`);
      });
    }
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}
