// PBS Admin - Client Service
// Handles all database operations for Clients

import { query, execute } from "../db";
import type { Client, ClientInput, ClientWithRelations } from "../types";
import { normalizeEmail, normalizeMobile } from "../utils/validation";

/**
 * Get all clients
 */
export async function getAllClients(): Promise<Client[]> {
  return query<Client>(`
    SELECT * FROM Client
    ORDER BY lastName, firstName
  `);
}

/**
 * Get client by ID with related data
 */
export async function getClientById(clientId: number): Promise<ClientWithRelations | null> {
  const clients = await query<Client>(`
    SELECT * FROM Client WHERE clientId = ?
  `, [clientId]);

  if (clients.length === 0) return null;

  const client = clients[0];

  // Get related counts
  const petCount = await query<{ count: number }>(`
    SELECT COUNT(*) as count FROM Pet WHERE clientId = ?
  `, [clientId]);

  const eventCount = await query<{ count: number }>(`
    SELECT COUNT(*) as count FROM Event WHERE clientId = ?
  `, [clientId]);

  const taskCount = await query<{ count: number }>(`
    SELECT COUNT(*) as count FROM Task WHERE clientId = ?
  `, [clientId]);

  return {
    ...client,
    _count: {
      pets: petCount[0]?.count || 0,
      events: eventCount[0]?.count || 0,
      tasks: taskCount[0]?.count || 0,
    },
  };
}

/**
 * Search for clients by email or mobile
 */
export async function findClientByEmailOrMobile(email: string, mobile: string): Promise<Client | null> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  const clients = await query<Client>(`
    SELECT * FROM Client
    WHERE email = ? OR mobile = ?
    LIMIT 1
  `, [normalizedEmail, normalizedMobile]);

  return clients.length > 0 ? clients[0] : null;
}

/**
 * Create a new client
 */
export async function createClient(input: ClientInput): Promise<Client> {
  const normalizedInput = {
    ...input,
    email: normalizeEmail(input.email),
    mobile: normalizeMobile(input.mobile),
  };

  const values = [
    normalizedInput.firstName,
    normalizedInput.lastName,
    normalizedInput.email,
    normalizedInput.mobile,
    normalizedInput.streetAddress || null,
    normalizedInput.city || null,
    normalizedInput.state || null,
    normalizedInput.postcode || null,
    normalizedInput.notes || null,
  ];

  const result = await execute(`
    INSERT INTO Client (
      firstName, lastName, email, mobile,
      streetAddress, city, state, postcode,
      notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, values);

  if (!result.lastInsertId) {
    throw new Error("Failed to create client - no ID returned");
  }

  const newClient = await getClientById(result.lastInsertId);
  if (!newClient) {
    throw new Error("Failed to retrieve created client");
  }

  return newClient;
}

/**
 * Update an existing client
 */
export async function updateClient(clientId: number, input: Partial<ClientInput>): Promise<Client> {
  const normalizedInput = {
    ...input,
    email: input.email ? normalizeEmail(input.email) : undefined,
    mobile: input.mobile ? normalizeMobile(input.mobile) : undefined,
  };

  const updates: string[] = [];
  const values: any[] = [];

  Object.entries(normalizedInput).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (updates.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(clientId);

  await execute(`
    UPDATE Client
    SET ${updates.join(", ")}, updatedAt = CURRENT_TIMESTAMP
    WHERE clientId = ?
  `, values);

  const updatedClient = await getClientById(clientId);
  if (!updatedClient) {
    throw new Error("Client not found after update");
  }

  return updatedClient;
}

/**
 * Delete a client (CASCADE will delete related pets and events)
 */
export async function deleteClient(clientId: number): Promise<void> {
  await execute(`DELETE FROM Client WHERE clientId = ?`, [clientId]);
}

/**
 * Search clients by query string
 */
export async function searchClients(searchQuery: string): Promise<Client[]> {
  const searchPattern = `%${searchQuery}%`;
  return query<Client>(`
    SELECT * FROM Client
    WHERE
      firstName LIKE ? OR
      lastName LIKE ? OR
      email LIKE ? OR
      mobile LIKE ? OR
      city LIKE ?
    ORDER BY lastName, firstName
  `, [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]);
}

/**
 * Get clients for dashboard view with computed fields
 */
export async function getClientsForDashboard() {
  return query<any>(`
    SELECT
      c.*,
      COUNT(DISTINCT p.petId) as petCount,
      MAX(e.date) as lastEventDate,
      CASE WHEN c.notes IS NOT NULL AND c.notes != '' THEN 1 ELSE 0 END as hasNotes
    FROM Client c
    LEFT JOIN Pet p ON c.clientId = p.clientId
    LEFT JOIN Event e ON c.clientId = e.clientId
    GROUP BY c.clientId
    ORDER BY c.lastName, c.firstName
  `);
}
