/**
 * Jotform Questionnaire Sync Service
 * Downloads submitted questionnaires, files them to client folders, and
 * updates matching Client/Pet records.
 *
 * Phase 3 rewrite:
 *  - Multi-pet aware: `ParsedQuestionnaire.pets: ParsedPet[]` (length ≥ 1)
 *  - Structured parsing: sex split into {sex, desexed}, weight parsed to kg,
 *    age preserved as `reportedAge` string
 *  - Per-pet matching with scoring + visible match status in event notes
 *  - Atomic dedup via QuestionnaireLog (INSERT OR IGNORE) replacing the
 *    racy Settings-based Set
 */

import { logger } from '../utils/logger';
import {
  updateClient,
  findClientByEmailOrMobile,
} from './clientService';
import {
  getPetsByClientId,
  updatePet,
} from './petService';
import {
  createEvent,
} from './eventService';
import type { Client, Pet, PetInput } from '../types';
import { formatISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { parseAgeToDateOfBirth } from '../utils/ageUtils';
import { getSettingJson, deleteSetting } from './settingsService';
import { JotformSubmissionSchema, safeParseArray } from '../schemas';
import {
  tryClaimSubmission,
  markDone,
  markFailed,
  getAllLoggedIds,
  backfillFromLegacySetting,
  getLog,
} from './questionnaireLogService';

const TIMEZONE = 'Australia/Melbourne';

const API_KEY = import.meta.env.VITE_JOTFORM_API_KEY;
const DOG_FORM_ID = import.meta.env.VITE_JOTFORM_DOG_FORM_ID;
const CAT_FORM_ID = import.meta.env.VITE_JOTFORM_CAT_FORM_ID;
const API_BASE = 'https://api.jotform.com';
const LEGACY_PROCESSED_KEY = 'pbs_admin_processed_jotform_submissions';

// Multi-pet form detection: QID 100 holds the pet-count selector.
// Each subsequent pet block occupies a 10-QID window starting at 101.
// Adjust these to match the actual Jotform form when it's redesigned.
const MULTI_PET_COUNT_QID = '100';
const MULTI_PET_BLOCK_BASE = 101;
const MULTI_PET_BLOCK_STRIDE = 10;
const MULTI_PET_MAX = 5;

// ============================================================================
// Types
// ============================================================================

export interface JotformAnswer {
  name: string;
  order: string;
  text: string;
  type: string;
  answer: string | Record<string, string>;
  prettyFormat?: string;
}

export interface JotformSubmission {
  id: string;
  form_id: string;
  ip: string;
  created_at: string;
  status: string;
  new: string;
  flag: string;
  notes: string;
  updated_at: string | null;
  answers: Record<string, JotformAnswer>;
}

/**
 * Single parsed pet with structured, normalized fields.
 * Absent fields are `undefined` — callers must guard before writing.
 */
export interface ParsedPet {
  name: string;
  species: 'Dog' | 'Cat' | string;
  breed?: string;
  reportedAge?: string;      // raw owner string — always preserved
  dateOfBirth?: string;      // ISO 8601, only if owner gave a DOB picker value
  sex?: 'Male' | 'Female' | 'Unknown';
  desexed?: 'Yes' | 'No' | 'Unknown';
  desexedDate?: string;
  weightKg?: number;
}

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
  pets: ParsedPet[];         // always length ≥ 1
  submittedAt: string;
  allAnswers: Record<string, any>;
}

/** Per-pet match outcome, serialized into the QuestionnaireReceived event. */
export interface PetMatchResult {
  parsedName: string;
  petId: number | null;
  status: 'updated' | 'unmatched' | 'ambiguous' | 'no_write_needed';
  fieldsUpdated: string[];
}

export interface QuestionnaireSyncResult {
  success: boolean;
  submissionId: string;
  clientId?: number;
  clientName: string;
  petResults: PetMatchResult[];
  eventId?: number;
  filesDownloaded: {
    json: boolean;
    pdf: boolean;
  };
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse sex + desexed status from any of the strings historical Jotform
 * forms have produced. Replaces the broken `mapSexValue` which returned
 * dropdown-incompatible values like "Neutered" and "Spayed".
 */
export function parseSexAndDesexed(input: string | undefined | null):
  { sex: 'Male' | 'Female' | 'Unknown'; desexed: 'Yes' | 'No' | 'Unknown' } {
  if (!input) return { sex: 'Unknown', desexed: 'Unknown' };
  const s = input.toLowerCase().trim();

  const isMale = /\bmale\b/.test(s) && !/\bfemale\b/.test(s);
  const isFemale = /\bfemale\b/.test(s);
  const isDesexed = /\b(neutered|castrated|spayed|desexed|desex(ing)?)\b/.test(s);
  const isEntire = /\b(entire|intact|un[\-\s]?neutered|un[\-\s]?desexed)\b/.test(s);

  // "Spayed" alone implies female by convention
  if (!isMale && !isFemale && /\bspayed\b/.test(s)) {
    return { sex: 'Female', desexed: 'Yes' };
  }
  // "Neutered" / "Castrated" alone is ambiguous — leave sex Unknown
  if (!isMale && !isFemale && /\b(neutered|castrated)\b/.test(s)) {
    return { sex: 'Unknown', desexed: 'Yes' };
  }

  const sex: 'Male' | 'Female' | 'Unknown' =
    isMale ? 'Male' : isFemale ? 'Female' : 'Unknown';

  const desexed: 'Yes' | 'No' | 'Unknown' =
    isDesexed ? 'Yes' : isEntire ? 'No' : 'Unknown';

  return { sex, desexed };
}

/**
 * Parse a weight string into kilograms. Accepts:
 *   "35", "35kg", "35 kg", "35.5kg", "35 kilos", "35 kilograms"
 *   "77lb", "77 lbs", "77 pounds" → converts to kg
 *
 * Rejects ambiguous multi-pet strings like "Teddy 35kg Bear 45kg" by
 * detecting two numeric runs.
 */
export function parseWeight(input: string | undefined | null): number | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;

  // Detect ambiguous multi-weight strings (more than one number)
  const numberCount = (s.match(/\d+(?:\.\d+)?/g) ?? []).length;
  if (numberCount > 1) return undefined;

  const match = s.match(/(\d+(?:\.\d+)?)\s*([a-z]*)/i);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  if (!isFinite(value) || value <= 0) return undefined;

  const unit = (match[2] || '').toLowerCase();
  if (unit === '' || unit === 'kg' || unit.startsWith('kilo')) return value;
  if (unit === 'lb' || unit === 'lbs' || unit.startsWith('pound')) {
    return Math.round(value * 0.453592 * 100) / 100;
  }
  if (unit === 'g' || unit === 'gram' || unit === 'grams') return value / 1000;
  // Unknown unit — treat as kg but round
  return value;
}

/** Strip punctuation and lowercase for fuzzy name matching. */
function normalizePetName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Score how well a ParsedPet matches an existing Pet row.
 *   100 — exact normalized name match
 *    60 — one name contains the other (substring)
 *    20 — species match only
 *     0 — no overlap
 *
 * Used by the per-pet auto-matcher. Anything ≥ 80 auto-matches;
 * ambiguous or lower scores fall through to the reconciliation UI.
 */
export function scorePetMatch(parsed: ParsedPet, existing: Pet): number {
  const p = normalizePetName(parsed.name);
  const e = normalizePetName(existing.name);
  if (!p || !e) return 0;
  if (p === e) return 100;
  if (e.includes(p) || p.includes(e)) return 60;
  if (parsed.species.toLowerCase() === existing.species.toLowerCase()) return 20;
  return 0;
}

// ============================================================================
// Fetch + dedup
// ============================================================================

/**
 * One-time migration from the legacy Settings-based Set into QuestionnaireLog.
 * Idempotent — runs at most once per app install, then deletes the Setting.
 */
let legacyBackfillDone = false;
async function ensureLegacyBackfill(): Promise<void> {
  if (legacyBackfillDone) return;
  try {
    const legacyIds = await getSettingJson<string[]>(LEGACY_PROCESSED_KEY, []);
    if (legacyIds.length > 0) {
      const inserted = await backfillFromLegacySetting(legacyIds);
      logger.info(`[Jotform] Backfilled ${inserted} legacy submission IDs into QuestionnaireLog`);
    }
    await deleteSetting(LEGACY_PROCESSED_KEY);
    legacyBackfillDone = true;
  } catch (error) {
    logger.warn('[Jotform] Legacy backfill failed (non-fatal):', error);
  }
}

/**
 * Fetch submissions from last 30 days that haven't been logged yet.
 * A submission is "unlogged" if it has no row in QuestionnaireLog (any status).
 */
export async function fetchUnprocessedSubmissions(): Promise<JotformSubmission[]> {
  await ensureLegacyBackfill();
  try {
    const submissions: JotformSubmission[] = [];

    for (const formId of [DOG_FORM_ID, CAT_FORM_ID]) {
      const url = `${API_BASE}/form/${formId}/submissions?apiKey=${API_KEY}&limit=100&orderby=created_at`;
      const response = await fetch(url);
      if (!response.ok) {
        logger.error(`Failed to fetch submissions for form ${formId}:`, response.statusText);
        continue;
      }
      const data = await response.json();
      if (data.content && Array.isArray(data.content)) {
        const validated = safeParseArray(JotformSubmissionSchema, data.content, `Jotform form ${formId}`);
        submissions.push(...validated as JotformSubmission[]);
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = submissions.filter((s) => new Date(s.created_at) >= thirtyDaysAgo);

    const loggedIds = await getAllLoggedIds();
    const unprocessed = recent.filter((s) => !loggedIds.has(s.id));

    logger.debug(`[Jotform] ${recent.length} recent submissions, ${unprocessed.length} unlogged`);
    return unprocessed;
  } catch (error) {
    logger.error('[Jotform] fetchUnprocessedSubmissions failed:', error);
    return [];
  }
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Detect which form schema this submission uses:
 *   'multi-pet'     — new form with QID 100 pet-count selector
 *   'legacy-single' — original form, one pet per submission
 */
function detectFormSchema(answers: Record<string, JotformAnswer>): 'multi-pet' | 'legacy-single' {
  const countAnswer = answers[MULTI_PET_COUNT_QID]?.answer;
  if (typeof countAnswer === 'string' && /^\d+$/.test(countAnswer)) {
    return 'multi-pet';
  }
  return 'legacy-single';
}

/**
 * Parse pets from a multi-pet submission.
 * Each pet occupies a 10-QID block starting at MULTI_PET_BLOCK_BASE.
 * Block layout (offsets from block base):
 *   +0 name   +1 species  +2 breed   +3 dateOfBirth   +4 reportedAge
 *   +5 sex    +6 desexed  +7 desexedDate  +8 weight  +9 (reserved)
 */
function parseMultiPet(
  answers: Record<string, JotformAnswer>,
  submissionFormType: 'dog' | 'cat'
): ParsedPet[] {
  const countStr = answers[MULTI_PET_COUNT_QID]?.answer;
  const count = Math.min(
    MULTI_PET_MAX,
    Math.max(1, parseInt(typeof countStr === 'string' ? countStr : '1', 10) || 1)
  );

  const pets: ParsedPet[] = [];
  for (let i = 0; i < count; i++) {
    const base = MULTI_PET_BLOCK_BASE + i * MULTI_PET_BLOCK_STRIDE;
    const a = (offset: number) => answers[String(base + offset)]?.answer;

    const name = typeof a(0) === 'string' ? (a(0) as string) : '';
    if (!name) continue;

    const species = typeof a(1) === 'string' ? (a(1) as string) : (submissionFormType === 'dog' ? 'Dog' : 'Cat');
    const breed = typeof a(2) === 'string' ? (a(2) as string).trim() : '';
    const dob = typeof a(3) === 'string' ? (a(3) as string) : '';
    const reportedAge = typeof a(4) === 'string' ? (a(4) as string) : '';
    const sexRaw = typeof a(5) === 'string' ? (a(5) as string) : '';
    const desexedRaw = typeof a(6) === 'string' ? (a(6) as string).toLowerCase() : '';
    const desexedDate = typeof a(7) === 'string' ? (a(7) as string) : '';
    const weightStr = typeof a(8) === 'string' ? (a(8) as string) : '';

    const parsedSex = parseSexAndDesexed(sexRaw);
    // Prefer explicit desexed field if present
    let desexed: 'Yes' | 'No' | 'Unknown' = parsedSex.desexed;
    if (desexedRaw) {
      if (/^yes$/.test(desexedRaw)) desexed = 'Yes';
      else if (/^no$/.test(desexedRaw)) desexed = 'No';
    }

    pets.push({
      name: name.trim(),
      species: species.trim() || (submissionFormType === 'dog' ? 'Dog' : 'Cat'),
      breed: breed || undefined,
      reportedAge: reportedAge.trim() || undefined,
      dateOfBirth: dob || undefined,
      sex: parsedSex.sex,
      desexed,
      desexedDate: desexedDate || undefined,
      weightKg: parseWeight(weightStr),
    });
  }

  return pets;
}

/**
 * Parse a single pet from the legacy form layout.
 * QIDs are hardcoded and apply to both Dog and Cat forms.
 */
function parseLegacySingle(
  answers: Record<string, JotformAnswer>,
  submissionFormType: 'dog' | 'cat'
): ParsedPet[] {
  const petName = answers['8']?.answer as string || '';
  if (!petName) return [];

  const breed = answers['19']?.answer as string || '';
  const age = answers['23']?.answer as string || '';
  const sexRaw = answers['22']?.answer as string || '';
  const weight = answers['69']?.answer as string || '';

  const { sex, desexed } = parseSexAndDesexed(sexRaw);

  return [{
    name: petName.trim(),
    species: submissionFormType === 'dog' ? 'Dog' : 'Cat',
    breed: breed.trim() || undefined,
    reportedAge: age.trim() || undefined,
    sex,
    desexed,
    weightKg: parseWeight(weight),
  }];
}

/** Top-level parse — handles both schemas and returns the pets array. */
export function parseSubmission(submission: JotformSubmission): ParsedQuestionnaire | null {
  try {
    const answers = submission.answers;
    const formType: 'dog' | 'cat' = submission.form_id === DOG_FORM_ID ? 'dog' : 'cat';

    const nameAnswer = answers['3'];
    const firstName = typeof nameAnswer?.answer === 'object'
      ? ((nameAnswer.answer as any).first || '') : '';
    const lastName = typeof nameAnswer?.answer === 'object'
      ? ((nameAnswer.answer as any).last || '') : '';
    const email = (answers['6']?.answer as string) || '';
    const phone = (answers['32']?.answer as string) || '';

    let address: ParsedQuestionnaire['address'];
    const addressAnswer = answers['68'];
    if (addressAnswer && typeof addressAnswer.answer === 'object') {
      const addr = addressAnswer.answer as any;
      address = {
        street: addr.addr_line1 || '',
        city: addr.city || '',
        state: addr.state || '',
        postcode: addr.postal || '',
      };
    }

    const schema = detectFormSchema(answers);
    const pets = schema === 'multi-pet'
      ? parseMultiPet(answers, formType)
      : parseLegacySingle(answers, formType);

    if (!firstName || !lastName || !email || pets.length === 0) {
      logger.warn('[Jotform] Missing required fields in submission:', submission.id,
        { hasFirstName: !!firstName, hasLastName: !!lastName, hasEmail: !!email, petCount: pets.length });
      return null;
    }

    logger.debug(`[Jotform] Parsed submission ${submission.id} (${schema}) — ${pets.length} pet(s):`,
      pets.map(p => `${p.name} [${p.sex}/${p.desexed}, ${p.weightKg ?? '?'}kg]`).join(', '));

    return {
      submissionId: submission.id,
      formType,
      firstName,
      lastName,
      email,
      phone,
      address,
      pets,
      submittedAt: submission.created_at,
      allAnswers: answers,
    };
  } catch (error) {
    logger.error('[Jotform] Failed to parse submission:', error);
    return null;
  }
}

// ============================================================================
// Client + file plumbing
// ============================================================================

async function findExistingClient(email: string, phone: string): Promise<Client | null> {
  return findClientByEmailOrMobile(email, phone);
}

async function downloadSubmissionFiles(
  submission: JotformSubmission,
  parsed: ParsedQuestionnaire,
  clientFolderPath: string
): Promise<{ json: boolean; pdf: boolean }> {
  const result = { json: false, pdf: false };

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    const addressString = parsed.address
      ? `${parsed.address.street}, ${parsed.address.city}, ${parsed.address.state}, ${parsed.address.postcode}`
      : '';

    // Capitalize formType for reconciliation service compat
    const formTypeCap = parsed.formType === 'dog' ? 'Dog' : 'Cat';

    // JSON shape: include `pets` array (new) AND first element as `pet`
    // (legacy, for Stage B reconciliation which hasn't been rewritten yet).
    const firstPet = parsed.pets[0];
    const jsonContent = JSON.stringify({
      submissionId: parsed.submissionId,
      formType: formTypeCap,
      submittedAt: parsed.submittedAt,
      client: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        phone: parsed.phone,
        address: addressString,
      },
      pet: {
        name: firstPet.name,
        species: firstPet.species,
        breed: firstPet.breed || '',
        age: firstPet.reportedAge || '',
        sex: firstPet.sex || '',
        weight: firstPet.weightKg != null ? `${firstPet.weightKg}kg` : '',
      },
      pets: parsed.pets,
      allAnswers: parsed.allAnswers,
    }, null, 2);

    const jsonFileName = `questionnaire_${parsed.submissionId}_${Date.now()}.json`;
    const jsonPath = `${clientFolderPath}\\${jsonFileName}`;
    try {
      await invoke('write_text_file', { filePath: jsonPath, content: jsonContent });
      result.json = true;
    } catch (error) {
      logger.error('[Jotform] Failed to write JSON:', error);
    }

    const pdfFileName = `questionnaire_${parsed.submissionId}_${Date.now()}.pdf`;
    const pdfPath = `${clientFolderPath}\\${pdfFileName}`;
    const pdfUrl = `${API_BASE}/generatePDF?formid=${submission.form_id}&submissionid=${parsed.submissionId}&apiKey=${API_KEY}&download=1`;
    try {
      await invoke('download_file', { url: pdfUrl, filePath: pdfPath });
      result.pdf = true;
    } catch (error) {
      logger.error('[Jotform] Failed to download PDF:', error);
    }

    return result;
  } catch (error) {
    logger.error('[Jotform] downloadSubmissionFiles failed:', error);
    return result;
  }
}

// ============================================================================
// Per-pet matcher + field writer
// ============================================================================

/**
 * Field-update strategy when a pet is matched:
 *   weightKg     — always overwrite (latest wins)
 *   reportedAge  — always overwrite
 *   dateOfBirth  — only if currently null; flag approximate if derived from age
 *   sex, desexed, desexedDate, breed — only if currently null/Unknown
 *
 * Returns the list of fields actually updated (for the match log).
 */
async function applyPetUpdatesFromQuestionnaire(
  pet: Pet,
  parsed: ParsedPet
): Promise<string[]> {
  const updates: Partial<PetInput> = {};

  if (parsed.weightKg != null) {
    updates.weightKg = parsed.weightKg;
  }
  if (parsed.reportedAge) {
    updates.reportedAge = parsed.reportedAge;
  }

  // DOB: prefer explicit DOB from form; fall back to age-string parse.
  if (!pet.dateOfBirth) {
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
  }

  const isEmptyOrUnknown = (v: string | null) => !v || v === 'Unknown';
  if (parsed.sex && parsed.sex !== 'Unknown' && isEmptyOrUnknown(pet.sex)) {
    updates.sex = parsed.sex;
  }
  if (parsed.desexed && parsed.desexed !== 'Unknown' && isEmptyOrUnknown(pet.desexed)) {
    updates.desexed = parsed.desexed;
  }
  if (parsed.desexedDate && !pet.desexedDate) {
    updates.desexedDate = parsed.desexedDate;
  }
  if (parsed.breed && !pet.breed) {
    updates.breed = parsed.breed;
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return [];
  await updatePet(pet.petId, updates);
  return keys;
}

/** Match a single parsed pet against the client's existing pets. */
function matchPetAgainstClient(
  parsed: ParsedPet,
  clientPets: Pet[]
): { pet: Pet | null; status: 'matched' | 'unmatched' | 'ambiguous' } {
  if (clientPets.length === 0) return { pet: null, status: 'unmatched' };
  const scored = clientPets
    .map((p) => ({ pet: p, score: scorePetMatch(parsed, p) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  if (best.score < 80) return { pet: null, status: 'unmatched' };
  if (second && second.score >= best.score - 10) {
    return { pet: null, status: 'ambiguous' };
  }
  return { pet: best.pet, status: 'matched' };
}

// ============================================================================
// processQuestionnaire — main entry point for one submission
// ============================================================================

export async function processQuestionnaire(
  submission: JotformSubmission
): Promise<QuestionnaireSyncResult> {
  let parsed: ParsedQuestionnaire | null = null;
  let client: Client | null = null;
  const petResults: PetMatchResult[] = [];
  let filesDownloaded = { json: false, pdf: false };
  let claimed = false;

  try {
    // 1. Claim the submission atomically. If someone else has it, skip.
    claimed = await tryClaimSubmission(submission.id, submission.form_id);
    if (!claimed) {
      const existing = await getLog(submission.id);
      return {
        success: false,
        submissionId: submission.id,
        clientName: 'Unknown',
        petResults: [],
        filesDownloaded,
        error: `Submission already ${existing?.status ?? 'claimed'} (skipping to avoid duplicate)`,
      };
    }

    // 2. Parse
    parsed = parseSubmission(submission);
    if (!parsed) {
      await markFailed(submission.id, 'Failed to parse submission');
      return {
        success: false,
        submissionId: submission.id,
        clientName: 'Unknown',
        petResults: [],
        filesDownloaded,
        error: 'Failed to parse submission data',
      };
    }

    // 3. Match client
    client = await findExistingClient(parsed.email, parsed.phone);
    if (!client) {
      await markFailed(submission.id, 'Client not found');
      return {
        success: false,
        submissionId: submission.id,
        clientName: `${parsed.firstName} ${parsed.lastName}`,
        petResults: [],
        filesDownloaded,
        error: 'Client not found — questionnaire cannot be matched to existing client',
      };
    }
    if (!client.folderPath) {
      await markFailed(submission.id, 'Client folder not created');
      return {
        success: false,
        submissionId: submission.id,
        clientName: `${client.firstName} ${client.lastName}`,
        clientId: client.clientId,
        petResults: [],
        filesDownloaded,
        error: 'Client folder not created yet',
      };
    }

    const validParsed = parsed;
    const validClient = client;

    // 4. Download files to client folder
    filesDownloaded = await downloadSubmissionFiles(
      submission, validParsed, validClient.folderPath!
    );

    // 5. Conservative client address fill — only empty fields
    if (validParsed.address) {
      const up: Record<string, string> = {};
      if (validParsed.address.street && !validClient.streetAddress) up.streetAddress = validParsed.address.street;
      if (validParsed.address.city && !validClient.city) up.city = validParsed.address.city;
      if (validParsed.address.state && !validClient.state) up.state = validParsed.address.state;
      if (validParsed.address.postcode && !validClient.postcode) up.postcode = validParsed.address.postcode;
      if (Object.keys(up).length > 0) {
        await updateClient(validClient.clientId, up);
      }
    }

    // 6. Per-pet matching + writes
    const clientPets = await getPetsByClientId(validClient.clientId);
    for (const parsedPet of validParsed.pets) {
      const match = matchPetAgainstClient(parsedPet, clientPets);

      if (match.status === 'ambiguous') {
        petResults.push({
          parsedName: parsedPet.name,
          petId: null,
          status: 'ambiguous',
          fieldsUpdated: [],
        });
        continue;
      }
      if (match.status === 'unmatched' || !match.pet) {
        petResults.push({
          parsedName: parsedPet.name,
          petId: null,
          status: 'unmatched',
          fieldsUpdated: [],
        });
        continue;
      }

      const fieldsUpdated = await applyPetUpdatesFromQuestionnaire(match.pet, parsedPet);
      petResults.push({
        parsedName: parsedPet.name,
        petId: match.pet.petId,
        status: fieldsUpdated.length > 0 ? 'updated' : 'no_write_needed',
        fieldsUpdated,
      });
    }

    // 7. Build and create the QuestionnaireReceived event
    const eventNotes = buildEventNotes(validParsed, petResults, filesDownloaded);
    const event = await createEvent({
      clientId: validClient.clientId,
      eventType: 'QuestionnaireReceived',
      date: formatISO(toZonedTime(new Date(validParsed.submittedAt), TIMEZONE)),
      notes: eventNotes,
      calendlyEventUri: undefined,
      calendlyStatus: undefined,
      invoiceFilePath: undefined,
      hostedInvoiceUrl: undefined,
      parentEventId: undefined,
    });

    // 8. Mark the claim done
    await markDone(submission.id);

    return {
      success: true,
      submissionId: submission.id,
      clientId: validClient.clientId,
      clientName: `${validClient.firstName} ${validClient.lastName}`,
      petResults,
      eventId: event.eventId,
      filesDownloaded,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Jotform] processQuestionnaire failed:', msg, error);
    if (claimed) {
      try { await markFailed(submission.id, msg); } catch { /* best-effort */ }
    }
    return {
      success: false,
      submissionId: submission.id,
      clientName: parsed ? `${parsed.firstName} ${parsed.lastName}` : 'Unknown',
      clientId: client?.clientId,
      petResults,
      filesDownloaded,
      error: msg,
    };
  }
}

// ============================================================================
// Event notes template with machine-readable matchState
// ============================================================================

function buildEventNotes(
  parsed: ParsedQuestionnaire,
  petResults: PetMatchResult[],
  files: { json: boolean; pdf: boolean }
): string {
  const formTypeLabel = parsed.formType === 'dog' ? 'Dog' : 'Cat';
  const petRows = parsed.pets.map((p) => {
    const r = petResults.find((x) => x.parsedName === p.name);
    const iconFor = (s?: PetMatchResult['status']) => {
      if (s === 'updated') return '✓';
      if (s === 'no_write_needed') return '✓';
      if (s === 'ambiguous') return '⚠';
      return '⚠';
    };
    const noteFor = (r: PetMatchResult | undefined) => {
      if (!r) return '(no result)';
      if (r.status === 'updated') return `updated Pet #${r.petId} (${r.fieldsUpdated.join(', ') || 'no fields'})`;
      if (r.status === 'no_write_needed') return `matched Pet #${r.petId} — no new data to write`;
      if (r.status === 'ambiguous') return `multiple possible matches — resolve via Review`;
      return `no match in client's pets — click Review to resolve`;
    };
    return `<li>${iconFor(r?.status)} <strong>${p.name}</strong> (${p.species}${p.breed ? ', ' + p.breed : ''}) — ${noteFor(r)}</li>`;
  }).join('\n    ');

  const matchState = { pets: petResults };
  const matchStateComment = `<!-- matchState: ${JSON.stringify(matchState)} -->`;

  return `
<p><strong>Submission ID:</strong> ${parsed.submissionId}</p>
<p><strong>Form Type:</strong> ${formTypeLabel} Behaviour Questionnaire</p>
<p><strong>Pets reported:</strong> ${parsed.pets.length}</p>
<p><strong>Match Status:</strong></p>
<ul>
    ${petRows}
</ul>
<p><em>Files saved to client folder:</em></p>
<ul>
  <li>${files.json ? '✓' : '✗'} JSON data</li>
  <li>${files.pdf ? '✓' : '✗'} PDF questionnaire</li>
</ul>
${matchStateComment}
  `.trim();
}

/**
 * Extract the matchState JSON from an event's notes HTML.
 * Returns null if the event was created before Phase 3 or the comment is missing.
 */
export function extractMatchState(
  notes: string | null
): { pets: PetMatchResult[] } | null {
  if (!notes) return null;
  const match = notes.match(/<!--\s*matchState:\s*(\{[\s\S]*?\})\s*-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ============================================================================
// Batch sync
// ============================================================================

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
  }

  return {
    total: submissions.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

// ============================================================================
// Legacy compat shim
// ============================================================================

/**
 * Back-compat shim for any external caller still importing the old
 * `markSubmissionAsProcessed`. Writes to QuestionnaireLog as 'done'.
 * @deprecated Use QuestionnaireLogService directly.
 */
export async function markSubmissionAsProcessed(submissionId: string): Promise<void> {
  try {
    await tryClaimSubmission(submissionId, 'unknown');
    await markDone(submissionId);
  } catch (error) {
    logger.warn('[Jotform] markSubmissionAsProcessed shim failed:', error);
  }
}
