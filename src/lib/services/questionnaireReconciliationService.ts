/**
 * Questionnaire Reconciliation Service
 * Compares questionnaire data with existing client/pet records and manages updates
 */

import { invoke } from '@tauri-apps/api/core';
import type { Client, Pet } from '../types';
import { getClientById, updateClient } from './clientService';
import { getAllPets, updatePet } from './petService';

/**
 * Questionnaire data structure (from saved JSON file)
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
    address: string;  // Full address string
  };
  pet: {
    name: string;
    species: string;
    breed?: string;
    age?: string;
    sex?: string;
    weight?: string;
  };
  allAnswers: Record<string, any>;
}

/**
 * Parsed address components
 */
export interface ParsedAddress {
  streetAddress: string;
  city: string;
  state: string;
  postcode: string;
}

/**
 * Field comparison result
 */
export interface FieldComparison {
  field: string;
  label: string;
  currentValue: string | null;
  questionnaireValue: string | null;
  status: 'match' | 'missing' | 'different' | 'new';
}

/**
 * Complete reconciliation result
 */
export interface ReconciliationResult {
  client: {
    record: Client;
    comparisons: FieldComparison[];
    hasChanges: boolean;
  };
  pet: {
    record: Pet | null;
    comparisons: FieldComparison[];
    hasChanges: boolean;
  };
  questionnaireData: QuestionnaireData;
}

/**
 * Find questionnaire JSON file by submission ID
 * Searches for files matching pattern: questionnaire_{submissionId}_*.json
 */
export async function findQuestionnaireFile(
  submissionId: string,
  folderPath: string
): Promise<string | null> {
  try {
    // List files in the client folder matching the submission ID pattern
    const pattern = `questionnaire_${submissionId}`;
    const files = await invoke<string[]>('list_files', {
      directory: folderPath,
      pattern: pattern
    });

    // Find .json files (should only be one per submission)
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.warn(`No questionnaire JSON file found for submission ${submissionId} in ${folderPath}`);
      return null;
    }

    if (jsonFiles.length > 1) {
      console.warn(`Multiple questionnaire JSON files found for submission ${submissionId}, using first one`);
    }

    return jsonFiles[0];
  } catch (error) {
    console.error('Failed to find questionnaire file:', error);
    return null;
  }
}

/**
 * Read questionnaire JSON file
 */
export async function readQuestionnaireFile(filePath: string): Promise<QuestionnaireData> {
  try {
    const content = await invoke<string>('read_text_file', { filePath });
    const data = JSON.parse(content) as QuestionnaireData;
    return data;
  } catch (error) {
    console.error('Failed to read questionnaire file:', error);
    throw new Error(`Failed to read questionnaire: ${error}`);
  }
}

/**
 * Parse full address string into components
 * Format: "123 Main St, Melbourne, VIC, 3000"
 */
export function parseAddress(addressString: string): ParsedAddress {
  // Default empty values
  const result: ParsedAddress = {
    streetAddress: '',
    city: '',
    state: '',
    postcode: '',
  };

  if (!addressString) return result;

  // Split by commas and clean up whitespace
  const parts = addressString.split(',').map(p => p.trim());

  if (parts.length >= 1) result.streetAddress = parts[0];
  if (parts.length >= 2) result.city = parts[1];
  if (parts.length >= 3) result.state = parts[2];
  if (parts.length >= 4) result.postcode = parts[3];

  return result;
}

/**
 * Normalize phone numbers for comparison (remove spaces, dashes, parentheses)
 */
function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/[\s\-\(\)]/g, '');
}

/**
 * Normalize strings for comparison (lowercase, trim)
 */
function normalizeString(str: string | null): string {
  if (!str) return '';
  return str.toLowerCase().trim();
}

/**
 * Compare two values and determine status
 */
function compareValues(current: string | null, questionnaire: string | null): 'match' | 'missing' | 'different' | 'new' {
  const currNorm = normalizeString(current);
  const questNorm = normalizeString(questionnaire);

  if (!currNorm && !questNorm) return 'match';
  if (!currNorm && questNorm) return 'new';
  if (currNorm && !questNorm) return 'missing';
  if (currNorm === questNorm) return 'match';
  return 'different';
}

/**
 * Compare client record with questionnaire data
 */
function compareClient(client: Client, questionnaireData: QuestionnaireData): FieldComparison[] {
  const qClient = questionnaireData.client;
  const parsedAddress = parseAddress(qClient.address);

  const comparisons: FieldComparison[] = [
    {
      field: 'firstName',
      label: 'First Name',
      currentValue: client.firstName,
      questionnaireValue: qClient.firstName,
      status: compareValues(client.firstName, qClient.firstName),
    },
    {
      field: 'lastName',
      label: 'Last Name',
      currentValue: client.lastName,
      questionnaireValue: qClient.lastName,
      status: compareValues(client.lastName, qClient.lastName),
    },
    {
      field: 'email',
      label: 'Email',
      currentValue: client.email,
      questionnaireValue: qClient.email,
      status: compareValues(client.email, qClient.email),
    },
    {
      field: 'mobile',
      label: 'Mobile',
      currentValue: client.mobile,
      questionnaireValue: qClient.phone,
      status: compareValues(normalizePhone(client.mobile), normalizePhone(qClient.phone)) as any,
    },
    {
      field: 'streetAddress',
      label: 'Street Address',
      currentValue: client.streetAddress || null,
      questionnaireValue: parsedAddress.streetAddress || null,
      status: compareValues(client.streetAddress, parsedAddress.streetAddress),
    },
    {
      field: 'city',
      label: 'City',
      currentValue: client.city || null,
      questionnaireValue: parsedAddress.city || null,
      status: compareValues(client.city, parsedAddress.city),
    },
    {
      field: 'state',
      label: 'State',
      currentValue: client.state || null,
      questionnaireValue: parsedAddress.state || null,
      status: compareValues(client.state, parsedAddress.state),
    },
    {
      field: 'postcode',
      label: 'Postcode',
      currentValue: client.postcode || null,
      questionnaireValue: parsedAddress.postcode || null,
      status: compareValues(client.postcode, parsedAddress.postcode),
    },
  ];

  return comparisons;
}

/**
 * Map questionnaire sex values to database format
 */
function mapSexValue(questionnaireSex: string | undefined): string | null {
  if (!questionnaireSex) return null;

  const normalized = questionnaireSex.toLowerCase().trim();

  // Questionnaire uses: "Male", "Female", "Male - Neutered", "Female - Spayed"
  // Database uses: "Male", "Female", "Neutered", "Spayed", "Unknown"
  if (normalized.includes('neutered')) return 'Neutered';
  if (normalized.includes('spayed')) return 'Spayed';
  if (normalized.includes('male')) return 'Male';
  if (normalized.includes('female')) return 'Female';

  return null;
}

/**
 * Compare pet record with questionnaire data
 */
function comparePet(pet: Pet | null, questionnaireData: QuestionnaireData): FieldComparison[] {
  const qPet = questionnaireData.pet;

  const comparisons: FieldComparison[] = [
    {
      field: 'name',
      label: 'Pet Name',
      currentValue: pet?.name || null,
      questionnaireValue: qPet.name,
      status: compareValues(pet?.name, qPet.name),
    },
    {
      field: 'species',
      label: 'Species',
      currentValue: pet?.species || null,
      questionnaireValue: qPet.species,
      status: compareValues(pet?.species, qPet.species),
    },
    {
      field: 'breed',
      label: 'Breed',
      currentValue: pet?.breed || null,
      questionnaireValue: qPet.breed || null,
      status: compareValues(pet?.breed, qPet.breed),
    },
    {
      field: 'sex',
      label: 'Sex',
      currentValue: pet?.sex || null,
      questionnaireValue: mapSexValue(qPet.sex),
      status: compareValues(pet?.sex, mapSexValue(qPet.sex)),
    },
    {
      field: 'age',
      label: 'Age (from questionnaire)',
      currentValue: pet?.dateOfBirth || null,
      questionnaireValue: qPet.age || null,
      status: qPet.age ? 'new' : 'match', // Always show age as reference
    },
    {
      field: 'weight',
      label: 'Weight',
      currentValue: null, // Not stored directly in pet record
      questionnaireValue: qPet.weight || null,
      status: qPet.weight ? 'new' : 'match',
    },
  ];

  return comparisons;
}

/**
 * Reconcile questionnaire data with existing records
 */
export async function reconcileQuestionnaire(
  clientId: number,
  questionnaireFilePath: string
): Promise<ReconciliationResult> {
  // Read questionnaire data
  const questionnaireData = await readQuestionnaireFile(questionnaireFilePath);

  // Get current client record
  const client = await getClientById(clientId);
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  // Get pet record (match by name from questionnaire)
  const allPets = await getAllPets();
  const clientPets = allPets.filter(p => p.clientId === clientId);
  const pet = clientPets.find(p =>
    normalizeString(p.name) === normalizeString(questionnaireData.pet.name)
  ) || null;

  // Compare records
  const clientComparisons = compareClient(client, questionnaireData);
  const petComparisons = comparePet(pet, questionnaireData);

  // Check if there are any changes
  const clientHasChanges = clientComparisons.some(c => c.status === 'new' || c.status === 'different');
  const petHasChanges = petComparisons.some(c => c.status === 'new' || c.status === 'different');

  return {
    client: {
      record: client,
      comparisons: clientComparisons,
      hasChanges: clientHasChanges,
    },
    pet: {
      record: pet,
      comparisons: petComparisons,
      hasChanges: petHasChanges,
    },
    questionnaireData,
  };
}

/**
 * Apply selected updates to client record
 */
export async function applyClientUpdates(
  client: Client,
  selectedFields: string[],
  questionnaireData: QuestionnaireData
): Promise<Client> {
  const updates: Partial<Client> = {};
  const parsedAddress = parseAddress(questionnaireData.client.address);

  for (const field of selectedFields) {
    switch (field) {
      case 'firstName':
        updates.firstName = questionnaireData.client.firstName;
        break;
      case 'lastName':
        updates.lastName = questionnaireData.client.lastName;
        break;
      case 'email':
        updates.email = questionnaireData.client.email;
        break;
      case 'mobile':
        updates.mobile = questionnaireData.client.phone;
        break;
      case 'streetAddress':
        updates.streetAddress = parsedAddress.streetAddress;
        break;
      case 'city':
        updates.city = parsedAddress.city;
        break;
      case 'state':
        updates.state = parsedAddress.state;
        break;
      case 'postcode':
        updates.postcode = parsedAddress.postcode;
        break;
    }
  }

  return await updateClient(client.clientId, updates);
}

/**
 * Apply selected updates to pet record
 */
export async function applyPetUpdates(
  pet: Pet,
  selectedFields: string[],
  questionnaireData: QuestionnaireData
): Promise<Pet> {
  const updates: Partial<Pet> = {};
  const qPet = questionnaireData.pet;

  for (const field of selectedFields) {
    switch (field) {
      case 'name':
        updates.name = qPet.name;
        break;
      case 'species':
        updates.species = qPet.species;
        break;
      case 'breed':
        if (qPet.breed) updates.breed = qPet.breed;
        break;
      case 'sex':
        const mappedSex = mapSexValue(qPet.sex);
        if (mappedSex) updates.sex = mappedSex;
        break;
      case 'weight':
        // Add weight to notes if provided
        if (qPet.weight) {
          const currentNotes = pet.notes || '';
          const weightNote = `Weight: ${qPet.weight}`;
          updates.notes = currentNotes ? `${currentNotes}\n${weightNote}` : weightNote;
        }
        break;
    }
  }

  return await updatePet(pet.petId, updates);
}
