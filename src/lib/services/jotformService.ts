/**
 * Jotform Questionnaire Sync Service
 * Automatically downloads submitted questionnaires and saves them to client folders
 */

import {
  getAllClients,
  updateClient,
} from './clientService';
import {
  getAllPets,
  updatePet,
} from './petService';
import {
  createEvent,
} from './eventService';
import type { Client, Pet } from '../types';
import { formatISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Australia/Melbourne';

const API_KEY = import.meta.env.VITE_JOTFORM_API_KEY;
const DOG_FORM_ID = import.meta.env.VITE_JOTFORM_DOG_FORM_ID;
const CAT_FORM_ID = import.meta.env.VITE_JOTFORM_CAT_FORM_ID;
const API_BASE = 'https://api.jotform.com';
const PROCESSED_SUBMISSIONS_KEY = 'pbs_admin_processed_jotform_submissions';

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
 * Get list of already-processed submission IDs from localStorage
 */
function getProcessedSubmissionIds(): Set<string> {
  try {
    const stored = localStorage.getItem(PROCESSED_SUBMISSIONS_KEY);
    if (!stored) return new Set();
    const ids = JSON.parse(stored);
    return new Set(Array.isArray(ids) ? ids : []);
  } catch (error) {
    console.error('Failed to read processed submissions from localStorage:', error);
    return new Set();
  }
}

/**
 * Mark a submission as processed
 */
function markSubmissionAsProcessed(submissionId: string): void {
  try {
    const processed = getProcessedSubmissionIds();
    processed.add(submissionId);
    localStorage.setItem(PROCESSED_SUBMISSIONS_KEY, JSON.stringify([...processed]));
  } catch (error) {
    console.error('Failed to save processed submission to localStorage:', error);
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
        console.error(`Failed to fetch submissions for form ${formId}:`, response.statusText);
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
    const processedIds = getProcessedSubmissionIds();
    const unprocessedSubmissions = recentSubmissions.filter(sub => !processedIds.has(sub.id));

    console.log(`Found ${recentSubmissions.length} recent submissions, ${unprocessedSubmissions.length} unprocessed`);

    return unprocessedSubmissions;

  } catch (error) {
    console.error('Failed to fetch Jotform submissions:', error);
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
    const sex = answers['22']?.answer as string || '';
    const weight = answers['69']?.answer as string || undefined;

    // Validate required fields
    if (!firstName || !lastName || !email || !petName) {
      console.warn('Missing required fields in submission:', submission.id);
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
    console.error('Failed to parse submission:', error);
    return null;
  }
}

/**
 * Find existing client by email (primary) or mobile (fallback)
 */
async function findExistingClient(
  email: string,
  phone: string
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
  if (phone) {
    // Remove all non-digit characters for comparison
    const cleanPhone = phone.replace(/\D/g, '');
    const byMobile = clients.find(c => {
      if (!c.mobile) return false;
      const cleanClientMobile = c.mobile.replace(/\D/g, '');
      return cleanClientMobile === cleanPhone;
    });
    if (byMobile) return byMobile;
  }

  return null;
}

/**
 * Find existing pet by name within a client's pets
 */
async function findExistingPet(
  clientId: number,
  petName: string
): Promise<Pet | null> {
  const allPets = await getAllPets();
  const clientPets = allPets.filter(p => p.clientId === clientId);

  // Match by name (case-insensitive)
  const matchedPet = clientPets.find(p =>
    p.name.toLowerCase() === petName.toLowerCase()
  );

  return matchedPet || null;
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
      console.log('✓ JSON saved to:', jsonPath);
    } catch (error) {
      console.error('Failed to write JSON file:', error);
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
      console.log('✓ PDF downloaded to:', pdfPath);
    } catch (error) {
      console.error('Failed to download/save PDF:', error);
    }

    return result;

  } catch (error) {
    console.error('Failed to download submission files:', error);
    return result;
  }
}

/**
 * Process a single questionnaire submission
 */
export async function processQuestionnaire(
  submission: JotformSubmission
): Promise<QuestionnaireSyncResult> {
  try {
    // Parse submission
    const parsed = parseSubmission(submission);
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

    // Find existing client
    const client = await findExistingClient(parsed.email, parsed.phone);

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

    // Download files to client folder
    const filesDownloaded = await downloadSubmissionFiles(
      submission,
      parsed,
      client.folderPath
    );

    // Update client address if questionnaire has address data
    if (parsed.address) {
      const shouldUpdateAddress =
        !client.streetAddress ||
        !client.city ||
        !client.state ||
        !client.postcode;

      if (shouldUpdateAddress) {
        await updateClient(client.clientId, {
          streetAddress: parsed.address.street || client.streetAddress || undefined,
          city: parsed.address.city || client.city || undefined,
          state: parsed.address.state || client.state || undefined,
          postcode: parsed.address.postcode || client.postcode || undefined,
        });
        console.log('✓ Updated client address from questionnaire');
      }
    }

    // Find existing pet and update with questionnaire data
    let pet = await findExistingPet(client.clientId, parsed.pet.name);

    if (pet) {
      // Update pet details with questionnaire data
      await updatePet(pet.petId, {
        breed: parsed.pet.breed || pet.breed || undefined,
        sex: parsed.pet.sex || pet.sex || undefined,
        // Note: We don't update dateOfBirth from age string here to avoid overwriting existing accurate data
        notes: pet.notes
          ? `${pet.notes}\n\nQuestionnaire data: Weight: ${parsed.pet.weight || 'N/A'}, Age reported: ${parsed.pet.age}`
          : `Questionnaire data: Weight: ${parsed.pet.weight || 'N/A'}, Age reported: ${parsed.pet.age}`,
      });
      console.log('✓ Updated pet details from questionnaire');
    }

    // Create "Questionnaire Received" event
    const event = await createEvent({
      clientId: client.clientId,
      eventType: 'QuestionnaireReceived',
      date: formatISO(toZonedTime(new Date(parsed.submittedAt), TIMEZONE)),
      notes: `
        <p><strong>Submission ID:</strong> ${parsed.submissionId}</p>
        <p><strong>Form Type:</strong> ${parsed.formType === 'dog' ? 'Dog' : 'Cat'} Behaviour Questionnaire</p>
        <p><strong>Pet:</strong> ${parsed.pet.name} (${parsed.pet.species})</p>
        <p><strong>Breed:</strong> ${parsed.pet.breed}</p>
        <p><strong>Age:</strong> ${parsed.pet.age}</p>
        <p><strong>Sex:</strong> ${parsed.pet.sex}</p>
        ${parsed.pet.weight ? `<p><strong>Weight:</strong> ${parsed.pet.weight}</p>` : ''}
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

    return {
      success: true,
      submissionId: submission.id,
      clientId: client.clientId,
      clientName: `${client.firstName} ${client.lastName}`,
      petId: pet?.petId,
      petName: parsed.pet.name,
      eventId: event.eventId,
      filesDownloaded,
    };

  } catch (error) {
    console.error('Failed to process questionnaire:', error);
    return {
      success: false,
      submissionId: submission.id,
      clientName: 'Unknown',
      petName: 'Unknown',
      filesDownloaded: { json: false, pdf: false },
      error: error instanceof Error ? error.message : 'Unknown error',
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
      markSubmissionAsProcessed(submission.id);
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
