// PBS Admin - Event Service
// Handles all database operations for Events

import { query, execute } from "../db";
import type { Event, EventInput, EventType } from "../types";
import { dateToISO, addDaysToDate } from "../utils/dateUtils";

/**
 * Get all events
 */
export async function getAllEvents(): Promise<Event[]> {
  return query<Event>(`
    SELECT * FROM Event
    ORDER BY date DESC
  `);
}

/**
 * Get event by ID
 */
export async function getEventById(eventId: number): Promise<Event | null> {
  const events = await query<Event>(`
    SELECT * FROM Event WHERE eventId = ?
  `, [eventId]);

  return events.length > 0 ? events[0] : null;
}

/**
 * Get events by client ID
 */
export async function getEventsByClientId(clientId: number): Promise<Event[]> {
  return query<Event>(`
    SELECT * FROM Event
    WHERE clientId = ?
    ORDER BY date DESC
  `, [clientId]);
}

/**
 * Get events by type
 */
export async function getEventsByType(eventType: EventType): Promise<Event[]> {
  return query<Event>(`
    SELECT * FROM Event
    WHERE eventType = ?
    ORDER BY date DESC
  `, [eventType]);
}

/**
 * Get upcoming events (future dates)
 */
export async function getUpcomingEvents(days: number = 30): Promise<Event[]> {
  const now = dateToISO(new Date());
  const futureDate = addDaysToDate(now, days);

  return query<Event>(`
    SELECT * FROM Event
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `, [now, futureDate]);
}

/**
 * Get upcoming bookings for dashboard
 */
export async function getUpcomingBookingsForDashboard(days: number = 30) {
  const now = dateToISO(new Date());
  const futureDate = addDaysToDate(now, days);

  return query<any>(`
    SELECT
      e.*,
      c.firstName || ' ' || c.lastName as clientName,
      GROUP_CONCAT(p.name, ', ') as petNames
    FROM Event e
    INNER JOIN Client c ON e.clientId = c.clientId
    LEFT JOIN Pet p ON c.clientId = p.clientId
    WHERE e.date >= ? AND e.date <= ?
    GROUP BY e.eventId
    ORDER BY e.date ASC
  `, [now, futureDate]);
}

/**
 * Create a new event
 */
export async function createEvent(input: EventInput): Promise<Event> {
  const result = await execute(`
    INSERT INTO Event (
      clientId, eventType, date, notes,
      calendlyEventUri, calendlyStatus,
      invoiceFilePath, hostedInvoiceUrl, parentEventId,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    input.clientId,
    input.eventType,
    input.date,
    input.notes || null,
    input.calendlyEventUri || "",
    input.calendlyStatus || "",
    input.invoiceFilePath || null,
    input.hostedInvoiceUrl || null,
    input.parentEventId || null,
  ]);

  if (!result.lastInsertId) {
    throw new Error("Failed to create event");
  }

  const newEvent = await getEventById(result.lastInsertId);
  if (!newEvent) {
    throw new Error("Failed to retrieve created event");
  }

  return newEvent;
}

/**
 * Update an existing event
 */
export async function updateEvent(eventId: number, input: Partial<EventInput>): Promise<Event> {
  const updates: string[] = [];
  const values: any[] = [];

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (updates.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(eventId);

  await execute(`
    UPDATE Event
    SET ${updates.join(", ")}, updatedAt = CURRENT_TIMESTAMP
    WHERE eventId = ?
  `, values);

  const updatedEvent = await getEventById(eventId);
  if (!updatedEvent) {
    throw new Error("Event not found after update");
  }

  return updatedEvent;
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: number): Promise<void> {
  await execute(`DELETE FROM Event WHERE eventId = ?`, [eventId]);
}

/**
 * Get child events
 */
export async function getChildEvents(parentEventId: number): Promise<Event[]> {
  return query<Event>(`
    SELECT * FROM Event
    WHERE parentEventId = ?
    ORDER BY date ASC
  `, [parentEventId]);
}

/**
 * Get parent event
 */
export async function getParentEvent(eventId: number): Promise<Event | null> {
  const events = await query<Event>(`
    SELECT parent.* FROM Event child
    INNER JOIN Event parent ON child.parentEventId = parent.eventId
    WHERE child.eventId = ?
  `, [eventId]);

  return events.length > 0 ? events[0] : null;
}
