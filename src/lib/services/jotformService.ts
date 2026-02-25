/**
 * Jotform Questionnaire Sync Service
 * Automatically downloads submitted questionnaires and saves them to client folders
 */

import { withTransaction } from '../db';
import { logger } from '../utils/logger';
import {
  updateClient,
  findClientByEmailOrMobile,
} from './clientService';
import {
  updatePet,
  findPetByNameAndClient,
} from './petService';
import {
  createEvent,
} from './eventService';
import type { Client, Pet } from '../types';
import { formatISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { parseAgeToDateOfBirth } from '../utils/ageUtils';
import { getSettingJson, setSettingJson } from './settingsService';

const TIMEZONE = 'Australia/Melbourne';

const API_KEY = import.meta.env.VITE_JOTFORM_API_KEY;
const DOG_FORM_ID = import.meta.env.VITE_JOTFORM_DOG_FORM_ID;
const CAT_FORM_ID = import.meta.env.VITE_JOTFORM_CAT_FORM_ID;
const API_BASE = 'https://api.jotform.com';
const PROCESSED_SUBMISSIONS_KEY = 'pbs_admin_processed_jotform_submissions';

/**
 * Normalize sex value from questionnaire format to database format
 * Questionnaire uses: "Male", "Female", "Males Neutered", "Females Spayed"
 * Database uses: "Male", "Female", "Neutered", "Spayed", "Unknown"
 */
function mapSexValue(questionnaireSex: string | undefined): string {
  if (!questionnaireSex) return '';
  const normalized = questionnaireSex.toLowerCase().trim();

  // Check for neutered/spayed first (more specific)
  if (normalized.includes('neutered')) return 'Neutered';
  if (normalized.includes('spayed')) return 'Spayed';
  if (normalized.includes('male')) return 'Male';
  if (normalized.includes('female')) return 'Female';

  return questionnaireSex; // Return original if no match
}

/**
 * Jotform submission record
 */
export interface JotformSubmission {
  id: string; // submission ID
  form_id: string;
  ip: string;
  created_at: string; // ISO timestamp
  status: string;
  new: string; // "1" or "0"
  flag: string;
  notes: string;
  updated_at: string | null;
  answers: Record<string, JotformAnswer>;
}

/**
 * Jotform answer structure
 */
export interface JotformAnswer {
  name: string; // field name
  order: string;
  text: string; // question text
  type: string; // field type
  answer: string | Record<string, string>; // answer value (can be complex object)
  prettyFormat?: string;
}

/**
 * Parsed questionnaire data
 */
export interface ParsedQuestionnaire {
  submissionId: string;
  formType: 'dog' | 'cat';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postcode: string;
  };
  pet: {
    name: string;
    species: 'Dog' | 'Cat';
    breed: string;
    age: string;
    sex: string;
    weight?: string;
  };
  submittedAt: string; // ISO timestamp
  allAnswers: Record<string, any>; // Full submission data
}

/**
 * Result of a questionnaire sync operation
 */
export interface QuestionnaireSyncResult {
  success: boolean;
  submissionId: string;
  clientId?: number;
  clientName: string;
  petId?: number;
  petName: string;
  eventId?: number;
  filesDownloaded: {
    json: boolean;
    pdf: boolean;
  };
  error?: string;
}

/**
 * Get list of already-processed submission IDs from SQLite
 */
async function getProcessedSubmissionIds(): Promise<Set<string>> {
  const ids = await getSettingJson<string[]>(PROCESSED_SUBMISSIONS_KEY, []);
  return new Set(ids);
}

/**
 * Mark a submission as processed
 */
export async function markSubmissionAsProcessed(submissionId: string): Promise<void> {
  try {
    const processed = await getProcessedSubmissionIds();
    processed.add(submissionId);
    await setSettingJson(PROCESSED_SUBMISSIONS_KEY, [...processed]);
  } catch (error) {
    logger.error('Failed to save processed submission:', error);
  }
}

/**
 * Fetch unprocessed submissions from Jotform API
 * Returns submissions from the last 30 days that haven't been synced yet
 */
export async function fetchUnprocessedSubmissions(): Promise<JotformSubmission[]> {
  try {
    const submissions: JotformSubmission[] = [];

    // Fetch submissions from both dog and cat forms
    for (const formId of [DOG_FORM_ID, CAT_FORM_ID]) {
      const url = `${API_BASE}/form/${formId}/submissions?apiKey=${API_KEY}&limit=100&orderby=created_at`;

      const response = await fetch(url);
      if (!response.ok) {
        logger.error(`Failed to fetch submissions for form ${formId}:`, response.statusText);
        continue;
      }

      const data = await response.json();
      if (data.content && Array.isArray(data.content)) {
        submissions.push(...data.content);
      }
    }

    // Filter to submissions from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubmissions = submissions.filter(sub => {
      const submittedDate = new Date(sub.created_at);
      return submittedDate >= thirtyDaysAgo;
    });

    // Filter out already-processed submissions
    const processedIds = await getProcessedSubmissionIds();
    const unprocessedSubmissions = recentSubmissions.filter(sub => !processedIds.has(sub.id));

    logger.debug(`Found ${recentSubmissions.length} recent submissions, ${unprocessedSubmissions.length} unprocessed`);

    return unprocessedSubmissions;

  } catch (error) {
    logger.error('Failed to fetch Jotform submissions:', error);
    return [];
  }
}

/**
 * Parse Jotform submission into structured data
 */
export function parseSubmission(submission: JotformSubmission): ParsedQuestionnaire | null {
  try {
    const answers = submission.answers;
    const formType = submission.form_id === DOG_FORM_ID ? 'dog' : 'cat';

    // Extract name (QID 3 - fullname)
    const nameAnswer = answers['3'];
    const firstName = typeof nameAnswer?.answer === 'object'
      ? (nameAnswer.answer as any).first || ''
      : '';
    const lastName = typeof nameAnswer?.answer === 'object'
      ? (nameAnswer.answer as any).last || ''
      : '';

    // Extract email (QID 6)
    const email = answers['6']?.answer as string || '';

    // Extract phone (QID 32)
    const phone = answers['32']?.answer as string || '';

    // Extract address (QID 68) - if present
    let address: ParsedQuestionnaire['address'] | undefined;
    const addressAnswer = answers['68'];
    if (addressAnswer && typeof addressAnswer.answer === 'object') {
      const addrObj = addressAnswer.answer as any;
      address = {
        street: addrObj.addr_line1 || '',
        city: addrObj.city || '',
        state: addrObj.state || '',
        postcode: addrObj.postal || '',
      };
    }

    // Extract pet info
    const petName = answers['8']?.answer as string || '';
    const breed = answers['19']?.answer as string || '';
    const age = answers['23']?.answer as string || '';
    const rawSex = answers['22']?.answer as string || '';
    const sex = mapSexValue(rawSex); // Normalize sex value
    const weight = answers['69']?.answer as string || undefined;

    // Log extracted pet info for debugging
    logger.debug(`Questionnaire pet info - Name: ${petName}, Breed: ${breed}, Age: ${age}, Sex: ${rawSex} → ${sex}, Weight: ${weight}`);

    // Validate required fields
    if (!firstName || !lastName || !email || !petName) {
      logger.warn('Missing required fields in submission:', submission.id);
      return null;
    }

    return {
      submissionId: submission.id,
      formType,
      firstName,
      lastName,
      email,
      phone,
      address,
      pet: {
        name: petName,
        species: formType === 'dog' ? 'Dog' : 'Cat',
        breed,
        age,
        sex,
        weight,
      },
      submittedAt: submission.created_at,
      allAnswers: answers,
    };

  } catch (error) {
    logger.error('Failed to parse submission:', error);
    return null;
  }
}

/**
 * Find existing client by email (primary) or mobile (fallback)
 * Uses efficient SQL-based lookup instead of loading all clients
 */
async function findExistingClient(
  email: string,
  phone: string
): Promise<Client | null> {
  return findClientByEmailOrMobile(email, phone);
}

/**
 * Find existing pet by name within a client's pets
 * Uses efficient SQL-based lookup instead of loading all pets
 */
async function findExistingPet(
  clientId: number,
  petName: string
): Promise<Pet | null> {
  return findPetByNameAndClient(petName, clientId);
}

/**
 * Download submission PDF and JSON to client folder
 */
async function downloadSubmissionFiles(
  submission: JotformSubmission,
  parsed: ParsedQuestionnaire,
  clientFolderPath: string
): Promise<{ json: boolean; pdf: boolean }> {
  const result = { json: false, pdf: false };

  try {
    // Import Tauri invoke
    const { invoke } = await import('@tauri-apps/api/core');

    // 1. Save JSON data
    const jsonFileName = `questionnaire_${parsed.submissionId}_${Date.now()}.json`;
    const jsonPath = `${clientFolderPath}\\${jsonFileName}`;

    // Format address as a string for reconciliation service compatibility
    const addressString = parsed.address
      ? `${parsed.address.street}, ${parsed.address.city}, ${parsed.address.state}, ${parsed.address.postcode}`
      : '';

    // Capitalize formType for reconciliation service compatibility
    const formType = parsed.formType === 'dog' ? 'Dog' : 'Cat';

    const jsonContent = JSON.stringify({
      submissionId: parsed.submissionId,
      formType: formType,
      submittedAt: parsed.submittedAt,
      client: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        phone: parsed.phone,
        address: addressString,
      },
      pet: parsed.pet,
      allAnswers: parsed.allAnswers,
    }, null, 2);

    try {
      await invoke('write_text_file', {
        filePath: jsonPath,
        content: jsonContent
      });
      result.json = true;
      logger.debug('JSON saved to:', jsonPath);
    } catch (error) {
      logger.error('Failed to write JSON file:', error);
    }

    // 2. Download and save PDF using Tauri command (bypasses CORS)
    const pdfFileName = `questionnaire_${parsed.submissionId}_${Date.now()}.pdf`;
    const pdfPath = `${clientFolderPath}\\${pdfFileName}`;
    const pdfUrl = `${API_BASE}/generatePDF?formid=${submission.form_id}&submissionid=${parsed.submissionId}&apiKey=${API_KEY}&download=1`;

    try {
      // Download PDF directly using Tauri (bypasses CORS restrictions)
      await invoke('download_file', {
        url: pdfUrl,
        filePath: pdfPath
      });
      result.pdf = true;
      logger.debug('PDF downloaded to:', pdfPath);
    } catch (error) {
      logger.error('Failed to download/save PDF:', error);
    }

    return result;

  } catch (error) {
    logger.error('Failed to download submission files:', error);
    return result;
  }
}

/**
 * Process a single questionnaire submission
 * Uses database transaction for atomic database operations
 */
export async function processQuestionnaire(
  submission: JotformSubmission
): Promise<QuestionnaireSyncResult> {
  // Declare outside try so catch block can access them
  let parsed: ParsedQuestionnaire | null = null;
  let client: Client | null = null;
  let filesDownloaded: { json: boolean; pdf: boolean } = { json: false, pdf: false };

  try {
    // Parse submission
    parsed = parseSubmission(submission);
    if (!parsed) {
      return {
        success: false,
        submissionId: submission.id,
        clientName: 'Unknown',
        petName: 'Unknown',
        filesDownloaded: { json: false, pdf: false },
        error: 'Failed to parse submission data',
      };
    }

    // Find existing client (read operation before transaction)
    client = await findExistingClient(parsed.email, parsed.phone);

    if (!client) {
      return {
        success: false,
        submissionId: submission.id,
        clientName: `${parsed.firstName} ${parsed.lastName}`,
        petName: parsed.pet.name,
        filesDownloaded: { json: false, pdf: false },
        error: 'Client not found - questionnaire cannot be matched to existing client',
      };
    }

    // Check if client has folder path
    if (!client.folderPath) {
      return {
        success: false,
        submissionId: submission.id,
        clientName: `${client.firstName} ${client.lastName}`,
        petName: parsed.pet.name,
        clientId: client.clientId,
        filesDownloaded: { json: false, pdf: false },
        error: 'Client folder not created yet',
      };
    }

    // At this point parsed and client are guaranteed non-null (early returns above)
    const validParsed = parsed;
    const validClient = client;

    // Download files to client folder (outside transaction - file operations)
    filesDownloaded = await downloadSubmissionFiles(
      submission,
      validParsed,
      validClient.folderPath!
    );

    // Find existing pet before transaction (read operation)
    const existingPet = await findExistingPet(validClient.clientId, validParsed.pet.name);

    // Wrap all database write operations in a transaction
    logger.debug(`[Questionnaire] Starting DB transaction for ${validParsed.firstName} ${validParsed.lastName}, pet: ${validParsed.pet.name}`);
    const result = await withTransaction(async () => {
      // Update client address if questionnaire has address data
      if (validParsed.address) {
        const addressUpdate: Record<string, string> = {};
        if (validParsed.address.street && !validClient.streetAddress) addressUpdate.streetAddress = validParsed.address.street;
        if (validParsed.address.city && !validClient.city) addressUpdate.city = validParsed.address.city;
        if (validParsed.address.state && !validClient.state) addressUpdate.state = validParsed.address.state;
        if (validParsed.address.postcode && !validClient.postcode) addressUpdate.postcode = validParsed.address.postcode;

        if (Object.keys(addressUpdate).length > 0) {
          await updateClient(validClient.clientId, addressUpdate);
          logger.debug('Updated client address from questionnaire');
        }
      }

      // Update pet details if pet exists
      let pet = existingPet;
      if (pet) {
        // Calculate DOB from age if pet doesn't already have one
        let calculatedDob: string | undefined;
        if (!pet.dateOfBirth && validParsed.pet.age) {
          calculatedDob = parseAgeToDateOfBirth(validParsed.pet.age) || undefined;
          if (calculatedDob) {
            logger.debug(`Calculated DOB from age "${validParsed.pet.age}": ${calculatedDob}`);
          }
        }

        // Update pet details with questionnaire data
        await updatePet(pet.petId, {
          breed: validParsed.pet.breed || pet.breed || undefined,
          sex: validParsed.pet.sex || pet.sex || undefined,
          dateOfBirth: calculatedDob || pet.dateOfBirth || undefined,
          notes: pet.notes
            ? `${pet.notes}\n\nQuestionnaire data: Weight: ${validParsed.pet.weight || 'N/A'}, Age reported: ${validParsed.pet.age}`
            : `Questionnaire data: Weight: ${validParsed.pet.weight || 'N/A'}, Age reported: ${validParsed.pet.age}`,
        });
        logger.debug('Updated pet details from questionnaire');
      }

      // Create "Questionnaire Received" event
      logger.debug('[Questionnaire] Creating QuestionnaireReceived event...');
      const event = await createEvent({
        clientId: validClient.clientId,
        eventType: 'QuestionnaireReceived',
        date: formatISO(toZonedTime(new Date(validParsed.submittedAt), TIMEZONE)),
        notes: `
          <p><strong>Submission ID:</strong> ${validParsed.submissionId}</p>
          <p><strong>Form Type:</strong> ${validParsed.formType === 'dog' ? 'Dog' : 'Cat'} Behaviour Questionnaire</p>
          <p><strong>Pet:</strong> ${validParsed.pet.name} (${validParsed.pet.species})</p>
          <p><strong>Breed:</strong> ${validParsed.pet.breed}</p>
          <p><strong>Age:</strong> ${validParsed.pet.age}</p>
          <p><strong>Sex:</strong> ${validParsed.pet.sex}</p>
          ${validParsed.pet.weight ? `<p><strong>Weight:</strong> ${validParsed.pet.weight}</p>` : ''}
          <p><em>Files saved to client folder:</em></p>
          <ul>
            <li>${filesDownloaded.json ? '✓' : '✗'} JSON data</li>
            <li>${filesDownloaded.pdf ? '✓' : '✗'} PDF questionnaire</li>
          </ul>
        `.trim(),
        calendlyEventUri: undefined,
        calendlyStatus: undefined,
        invoiceFilePath: undefined,
        hostedInvoiceUrl: undefined,
        parentEventId: undefined,
      });

      return { pet, event };
    });

    return {
      success: true,
      submissionId: submission.id,
      clientId: validClient.clientId,
      clientName: `${validClient.firstName} ${validClient.lastName}`,
      petId: result.pet?.petId,
      petName: validParsed.pet.name,
      eventId: result.event.eventId,
      filesDownloaded,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to process questionnaire:', errorMessage, error);
    return {
      success: false,
      submissionId: submission.id,
      clientName: parsed ? `${parsed.firstName} ${parsed.lastName}` : 'Unknown',
      petName: parsed?.pet?.name || 'Unknown',
      clientId: client?.clientId,
      filesDownloaded: filesDownloaded || { json: false, pdf: false },
      error: errorMessage,
    };
  }
}

/**
 * Sync all unprocessed questionnaires
 */
export async function syncAllQuestionnaires(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: QuestionnaireSyncResult[];
}> {
  const submissions = await fetchUnprocessedSubmissions();
  const results: QuestionnaireSyncResult[] = [];

  for (const submission of submissions) {
    const result = await processQuestionnaire(submission);
    results.push(result);

    // Mark as processed if successful to prevent re-downloading
    if (result.success) {
      await markSubmissionAsProcessed(submission.id);
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    total: submissions.length,
    successful,
    failed,
    results,
  };
}
