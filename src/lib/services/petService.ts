// PBS Admin - Pet Service
// Handles all database operations for Pets

import { query, execute } from "../db";
import type { Pet, PetInput } from "../types";

/**
 * Get all pets
 */
export async function getAllPets(): Promise<Pet[]> {
  return query<Pet>(`
    SELECT * FROM Pet
    ORDER BY name ASC
  `);
}

/**
 * Get pet by ID
 */
export async function getPetById(petId: number): Promise<Pet | null> {
  const pets = await query<Pet>(`
    SELECT * FROM Pet WHERE petId = ?
  `, [petId]);

  return pets.length > 0 ? pets[0] : null;
}

/**
 * Get pets by client ID
 */
export async function getPetsByClientId(clientId: number): Promise<Pet[]> {
  return query<Pet>(`
    SELECT * FROM Pet
    WHERE clientId = ?
    ORDER BY name ASC
  `, [clientId]);
}

/**
 * Find pet by name and client (case-insensitive name match)
 */
export async function findPetByNameAndClient(name: string, clientId: number): Promise<Pet | null> {
  const pets = await query<Pet>(`
    SELECT * FROM Pet
    WHERE LOWER(name) = LOWER(?) AND clientId = ?
    LIMIT 1
  `, [name, clientId]);

  return pets.length > 0 ? pets[0] : null;
}

/**
 * Create a new pet
 */
export async function createPet(input: PetInput): Promise<Pet> {
  const result = await execute(`
    INSERT INTO Pet (
      clientId, name, species, breed, sex, dateOfBirth, notes,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    input.clientId,
    input.name,
    input.species,
    input.breed || null,
    input.sex || null,
    input.dateOfBirth || null,
    input.notes || null,
  ]);

  if (!result.lastInsertId) {
    throw new Error("Failed to create pet");
  }

  const newPet = await getPetById(result.lastInsertId);
  if (!newPet) {
    throw new Error("Failed to retrieve created pet");
  }

  return newPet;
}

/**
 * Update an existing pet
 */
export async function updatePet(petId: number, input: Partial<PetInput>): Promise<Pet> {
  const updates: string[] = [];
  const values: any[] = [];

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && key !== 'clientId') { // Don't allow changing clientId
      updates.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (updates.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(petId);

  await execute(`
    UPDATE Pet
    SET ${updates.join(", ")}, updatedAt = CURRENT_TIMESTAMP
    WHERE petId = ?
  `, values);

  const updatedPet = await getPetById(petId);
  if (!updatedPet) {
    throw new Error("Pet not found after update");
  }

  return updatedPet;
}

/**
 * Delete a pet
 */
export async function deletePet(petId: number): Promise<void> {
  await execute(`DELETE FROM Pet WHERE petId = ?`, [petId]);
}
