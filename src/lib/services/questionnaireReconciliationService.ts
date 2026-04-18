/**
 * Questionnaire Reconciliation Service (Stage B)
 *
 * Compares questionnaire data (saved JSON from Stage A) with existing
 * Client/Pet records and lets the user selectively apply updates.
 *
 * Phase 5 rewrite:
 *  - Multi-pet aware: one reconciliation card per ParsedPet
 *  - Auto-match via scorePetMatch; user can pick a different target or
 *    create a new pet when the auto-match fails
 *  - New field comparisons: sex, desexed, desexedDate, weightKg, reportedAge,
 *    breed, dateOfBirth (with approximate flag)
 */

import { invoke } from '@tauri-apps/api/core';
import type { Client, Pet } from '../types';
import { getClientById, updateClient } from './clientService';
import { getPetsByClientId, updatePet, createPet } from './petService';
import { parseAgeToDateOfBirth } from '../utils/ageUtils';
import { logger } from '../utils/logger';
import {
  parseSexAndDesexed,
  parseWeight,
  scorePetMatch,
  type ParsedPet,
} from './jotformService';

// ============================================================================
// Types
// ============================================================================

/**
 * Shape of the saved questionnaire JSON file.
 * Supports both legacy (single `pet`) and new (`pets: ParsedPet[]`) formats.
 */
export interface QuestionnaireData {
  submissionId: string;
  formType: 'Dog' | 'Cat';
  submittedAt: string;
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
  };
  /** Legacy single-pet field — kept for backward compat. */
  pet?: {
    name: string;
    species: string;
    breed?: string;
    age?: string;
    sex?: string;
    weight?: string;
  };
  /** New multi-pet array — set when JSON was written by Phase 3+ Stage A. */
  pets?: ParsedPet[];
  allAnswers?: Record<string, any>;
}

export interface ParsedAddress {
  streetAddress: string;
  city: string;
  state: string;
  postcode: string;
}

export interface FieldComparison {
  field: string;
  label: string;
  currentValue: string | null;
  questionnaireValue: string | null;
  status: 'match' | 'missing' | 'different' | 'new';
}

/** Per-pet reconciliation state. */
export interface PerPetReconciliation {
  parsedPet: ParsedPet;
  /** Initially auto-matched pet, or null if unmatched/ambiguous. */
  targetPet: Pet | null;
  /** Whether Stage A's auto-match succeeded unambiguously. */
  autoMatched: boolean;
  comparisons: FieldComparison[];
  hasChanges: boolean;
}

export interface ReconciliationResult {
  client: {
    record: Client;
    comparisons: FieldComparison[];
    hasChanges: boolean;
  };
  /** All client pets — used by the UI pet-picker dropdown. */
  allClientPets: Pet[];
  pets: PerPetReconciliation[];
  questionnaireData: QuestionnaireData;
}

// ============================================================================
// File I/O
// ============================================================================

export async function findQuestionnaireFile(
  submissionId: string,
  folderPath: string
): Promise<string | null> {
  try {
    const files = await invoke<string[]>('list_files', {
      directory: folderPath,
      pattern: `questionnaire_${submissionId}`,
    });
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    if (jsonFiles.length === 0) {
      logger.warn(`No questionnaire JSON for submission ${submissionId}`);
      return null;
    }
    if (jsonFiles.length > 1) {
      logger.warn(`Multiple JSON files for ${submissionId}; using first`);
    }
    return jsonFiles[0];
  } catch (error) {
    logger.error('Failed to find questionnaire file:', error);
    return null;
  }
}

export async function readQuestionnaireFile(filePath: string): Promise<QuestionnaireData> {
  const content = await invoke<string>('read_text_file', { filePath });
  const raw = JSON.parse(content);
  return normalizeQuestionnaireData(raw);
}

/**
 * Normalize any JSON shape (legacy or Phase 3+) into a consistent
 * `QuestionnaireData` with `pets: ParsedPet[]` always populated.
 */
function normalizeQuestionnaireData(raw: any): QuestionnaireData {
  const data = { ...raw } as QuestionnaireData;

  // Legacy: address object → string
  if (data.client?.address && typeof data.client.address === 'object') {
    const addr: any = data.client.address;
    data.client.address = `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''}, ${addr.postcode || ''}`.trim();
  }

  // Legacy: formType lowercase → capitalized
  if ((data.formType as any) === 'dog') data.formType = 'Dog';
  else if ((data.formType as any) === 'cat') data.formType = 'Cat';

  // Build pets[] if missing (legacy single-pet JSON).
  if (!Array.isArray(data.pets) || data.pets.length === 0) {
    if (data.pet) {
      const { sex, desexed } = parseSexAndDesexed(data.pet.sex);
      data.pets = [{
        name: data.pet.name,
        species: data.pet.species || (data.formType === 'Dog' ? 'Dog' : 'Cat'),
        breed: data.pet.breed || undefined,
        reportedAge: data.pet.age || undefined,
        sex,
        desexed,
        weightKg: parseWeight(data.pet.weight),
      }];
    } else {
      data.pets = [];
    }
  }

  return data;
}

// ============================================================================
// Helpers
// ============================================================================

export function parseAddress(addressString: string): ParsedAddress {
  const result: ParsedAddress = { streetAddress: '', city: '', state: '', postcode: '' };
  if (!addressString) return result;
  const parts = addressString.split(',').map((p) => p.trim());
  if (parts.length >= 1) result.streetAddress = parts[0];
  if (parts.length >= 2) result.city = parts[1];
  if (parts.length >= 3) result.state = parts[2];
  if (parts.length >= 4) result.postcode = parts[3];
  return result;
}

function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/[\s\-\(\)]/g, '');
}

function normalizeString(str: string | null): string {
  if (!str) return '';
  return str.toLowerCase().trim();
}

function compareValues(
  current: string | null,
  questionnaire: string | null
): FieldComparison['status'] {
  const c = normalizeString(current);
  const q = normalizeString(questionnaire);
  if (!c && !q) return 'match';
  if (!c && q) return 'new';
  if (c && !q) return 'missing';
  if (c === q) return 'match';
  return 'different';
}

// ============================================================================
// Client comparison (unchanged from Phase 2)
// ============================================================================

function compareClient(client: Client, data: QuestionnaireData): FieldComparison[] {
  const q = data.client;
  const addr = parseAddress(q.address);
  return [
    { field: 'firstName', label: 'First Name',
      currentValue: client.firstName, questionnaireValue: q.firstName,
      status: compareValues(client.firstName, q.firstName) },
    { field: 'lastName', label: 'Last Name',
      currentValue: client.lastName, questionnaireValue: q.lastName,
      status: compareValues(client.lastName, q.lastName) },
    { field: 'email', label: 'Email',
      currentValue: client.email, questionnaireValue: q.email,
      status: compareValues(client.email, q.email) },
    { field: 'mobile', label: 'Mobile',
      currentValue: client.mobile, questionnaireValue: q.phone,
      status: compareValues(normalizePhone(client.mobile), normalizePhone(q.phone)) },
    { field: 'streetAddress', label: 'Street Address',
      currentValue: client.streetAddress || null, questionnaireValue: addr.streetAddress || null,
      status: compareValues(client.streetAddress, addr.streetAddress) },
    { field: 'city', label: 'City',
      currentValue: client.city || null, questionnaireValue: addr.city || null,
      status: compareValues(client.city, addr.city) },
    { field: 'state', label: 'State',
      currentValue: client.state || null, questionnaireValue: addr.state || null,
      status: compareValues(client.state, addr.state) },
    { field: 'postcode', label: 'Postcode',
      currentValue: client.postcode || null, questionnaireValue: addr.postcode || null,
      status: compareValues(client.postcode, addr.postcode) },
  ];
}

// ============================================================================
// Per-pet comparison (new field set)
// ============================================================================

function comparePet(pet: Pet | null, parsed: ParsedPet): FieldComparison[] {
  const weightStr = (n: number | null) => (n == null ? null : `${n} kg`);
  const dob = pet?.dateOfBirth || null;
  const parsedDob = parsed.dateOfBirth
    || (parsed.reportedAge ? parseAgeToDateOfBirth(parsed.reportedAge) : null);

  return [
    { field: 'name', label: 'Pet Name',
      currentValue: pet?.name || null, questionnaireValue: parsed.name,
      status: compareValues(pet?.name || null, parsed.name) },
    { field: 'species', label: 'Species',
      currentValue: pet?.species || null, questionnaireValue: parsed.species,
      status: compareValues(pet?.species || null, parsed.species) },
    { field: 'breed', label: 'Breed',
      currentValue: pet?.breed || null, questionnaireValue: parsed.breed || null,
      status: compareValues(pet?.breed || null, parsed.breed || null) },
    { field: 'sex', label: 'Sex',
      currentValue: pet?.sex || null, questionnaireValue: parsed.sex || null,
      status: compareValues(pet?.sex || null, parsed.sex || null) },
    { field: 'desexed', label: 'Desexed',
      currentValue: pet?.desexed || null, questionnaireValue: parsed.desexed || null,
      status: compareValues(pet?.desexed || null, parsed.desexed || null) },
    { field: 'desexedDate', label: 'Desexed Date',
      currentValue: pet?.desexedDate || null, questionnaireValue: parsed.desexedDate || null,
      status: compareValues(pet?.desexedDate || null, parsed.desexedDate || null) },
    { field: 'dateOfBirth', label: 'Date of Birth',
      currentValue: dob, questionnaireValue: parsedDob,
      status: compareValues(dob, parsedDob) },
    { field: 'weightKg', label: 'Weight',
      currentValue: weightStr(pet?.weightKg ?? null),
      questionnaireValue: weightStr(parsed.weightKg ?? null),
      status: compareValues(
        weightStr(pet?.weightKg ?? null),
        weightStr(parsed.weightKg ?? null)
      ) },
    { field: 'reportedAge', label: 'Reported Age',
      currentValue: pet?.reportedAge || null, questionnaireValue: parsed.reportedAge || null,
      status: compareValues(pet?.reportedAge || null, parsed.reportedAge || null) },
  ];
}

// ============================================================================
// Auto-match + top-level reconcile
// ============================================================================

/**
 * Score each parsed pet against client's pets. Returns the best match if
 * score ≥ 80 and no other candidate is within 10 points (unambiguous).
 */
function autoMatchPet(parsed: ParsedPet, clientPets: Pet[]): Pet | null {
  if (clientPets.length === 0) return null;
  const scored = clientPets
    .map((p) => ({ pet: p, score: scorePetMatch(parsed, p) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (best.score < 80) return null;
  if (second && second.score >= best.score - 10) return null;
  return best.pet;
}

export async function reconcileQuestionnaire(
  clientId: number,
  questionnaireFilePath: string
): Promise<ReconciliationResult> {
  const data = await readQuestionnaireFile(questionnaireFilePath);

  const client = await getClientById(clientId);
  if (!client) throw new Error(`Client not found: ${clientId}`);

  const allClientPets = await getPetsByClientId(clientId);
  const clientComparisons = compareClient(client, data);

  const pets: PerPetReconciliation[] = (data.pets ?? []).map((parsedPet) => {
    const matched = autoMatchPet(parsedPet, allClientPets);
    const comparisons = comparePet(matched, parsedPet);
    const hasChanges = comparisons.some((c) => c.status === 'new' || c.status === 'different');
    return {
      parsedPet,
      targetPet: matched,
      autoMatched: matched !== null,
      comparisons,
      hasChanges,
    };
  });

  return {
    client: {
      record: client,
      comparisons: clientComparisons,
      hasChanges: clientComparisons.some((c) => c.status === 'new' || c.status === 'different'),
    },
    allClientPets,
    pets,
    questionnaireData: data,
  };
}

/**
 * Recompute comparisons after the user picks a different target pet in the UI.
 * Pure function — no DB reads.
 */
export function recomputePetReconciliation(
  parsedPet: ParsedPet,
  targetPet: Pet | null
): PerPetReconciliation {
  const comparisons = comparePet(targetPet, parsedPet);
  return {
    parsedPet,
    targetPet,
    autoMatched: false,  // user-chosen
    comparisons,
    hasChanges: comparisons.some((c) => c.status === 'new' || c.status === 'different'),
  };
}

// ============================================================================
// Apply updates
// ============================================================================

export async function applyClientUpdates(
  client: Client,
  selectedFields: string[],
  data: QuestionnaireData
): Promise<Client> {
  const updates: Record<string, any> = {};
  const addr = parseAddress(data.client.address);
  for (const field of selectedFields) {
    switch (field) {
      case 'firstName': updates.firstName = data.client.firstName; break;
      case 'lastName': updates.lastName = data.client.lastName; break;
      case 'email': updates.email = data.client.email; break;
      case 'mobile': updates.mobile = data.client.phone; break;
      case 'streetAddress': if (addr.streetAddress) updates.streetAddress = addr.streetAddress; break;
      case 'city': if (addr.city) updates.city = addr.city; break;
      case 'state': if (addr.state) updates.state = addr.state; break;
      case 'postcode': if (addr.postcode) updates.postcode = addr.postcode; break;
    }
  }
  return updateClient(client.clientId, updates);
}

/**
 * Apply selected fields from `parsed` to an existing pet.
 * DOB, when selected, uses explicit parsed.dateOfBirth if present, otherwise
 * derives from reportedAge and flags approximate.
 */
export async function applyPetUpdatesFromParsed(
  pet: Pet,
  parsed: ParsedPet,
  selectedFields: string[]
): Promise<Pet> {
  const updates: Record<string, any> = {};
  for (const field of selectedFields) {
    switch (field) {
      case 'name': updates.name = parsed.name; break;
      case 'species': updates.species = parsed.species; break;
      case 'breed': if (parsed.breed) updates.breed = parsed.breed; break;
      case 'sex': if (parsed.sex) updates.sex = parsed.sex; break;
      case 'desexed': if (parsed.desexed) updates.desexed = parsed.desexed; break;
      case 'desexedDate': if (parsed.desexedDate) updates.desexedDate = parsed.desexedDate; break;
      case 'weightKg': if (parsed.weightKg != null) updates.weightKg = parsed.weightKg; break;
      case 'reportedAge': if (parsed.reportedAge) updates.reportedAge = parsed.reportedAge; break;
      case 'dateOfBirth': {
        if (parsed.dateOfBirth) {
          updates.dateOfBirth = parsed.dateOfBirth;
          updates.dateOfBirthIsApproximate = 0;
        } else if (parsed.reportedAge) {
          const derived = parseAgeToDateOfBirth(parsed.reportedAge);
          if (derived) {
            updates.dateOfBirth = derived;
            updates.dateOfBirthIsApproximate = 1;
          }
        }
        break;
      }
    }
  }
  return updatePet(pet.petId, updates);
}

/** Create a new pet from parsed data + the user's selected fields. */
export async function createPetFromParsed(
  clientId: number,
  parsed: ParsedPet,
  selectedFields: string[]
): Promise<Pet> {
  const data: any = {
    clientId,
    name: parsed.name,          // always required
    species: parsed.species,    // always required
  };
  for (const field of selectedFields) {
    switch (field) {
      case 'breed': if (parsed.breed) data.breed = parsed.breed; break;
      case 'sex': if (parsed.sex) data.sex = parsed.sex; break;
      case 'desexed': if (parsed.desexed) data.desexed = parsed.desexed; break;
      case 'desexedDate': if (parsed.desexedDate) data.desexedDate = parsed.desexedDate; break;
      case 'weightKg': if (parsed.weightKg != null) data.weightKg = parsed.weightKg; break;
      case 'reportedAge': if (parsed.reportedAge) data.reportedAge = parsed.reportedAge; break;
      case 'dateOfBirth': {
        if (parsed.dateOfBirth) {
          data.dateOfBirth = parsed.dateOfBirth;
          data.dateOfBirthIsApproximate = 0;
        } else if (parsed.reportedAge) {
          const derived = parseAgeToDateOfBirth(parsed.reportedAge);
          if (derived) {
            data.dateOfBirth = derived;
            data.dateOfBirthIsApproximate = 1;
          }
        }
        break;
      }
    }
  }
  return createPet(data);
}
