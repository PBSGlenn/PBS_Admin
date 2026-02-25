// Medication Update Service
// Uses Perplexity Sonar API to search for current Australian medication brand names

import { BEHAVIOR_MEDICATIONS, Medication } from '../medications';
import { getSetting, setSetting, getSettingJson, setSettingJson, deleteSetting } from './settingsService';
import { getPerplexityApiKey } from './apiKeysService';
import { logger } from '../utils/logger';

export interface MedicationUpdate {
  medicationId: string;
  genericName: string;
  category: string;
  currentBrands: string[];
  proposedBrands: string[];
  additions: string[];
  removals: string[];
  unchanged: string[];
  sources: string[];
  hasChanges: boolean;
}

export interface UpdateCheckResult {
  updates: MedicationUpdate[];
  totalChanges: number;
  lastChecked: Date;
  checkDuration: number; // milliseconds
}

export interface UpdateHistory {
  date: string;
  medicationId: string;
  genericName: string;
  changeType: 'addition' | 'removal';
  brandName: string;
  appliedBy: 'user' | 'auto';
}

// Settings keys
const LAST_CHECK_KEY = 'pbs_admin_medication_last_update_check';
const UPDATE_HISTORY_KEY = 'pbs_admin_medication_update_history';

/**
 * Get last update check date from SQLite
 */
export async function getLastUpdateCheckDate(): Promise<Date | null> {
  const lastCheck = await getSetting(LAST_CHECK_KEY);
  return lastCheck ? new Date(lastCheck) : null;
}

/**
 * Set last update check date in SQLite
 */
export async function setLastUpdateCheckDate(date: Date = new Date()): Promise<void> {
  await setSetting(LAST_CHECK_KEY, date.toISOString());
}

/**
 * Check if monthly update is due (30 days since last check)
 */
export async function isMonthlyUpdateDue(): Promise<boolean> {
  const lastCheck = await getLastUpdateCheckDate();
  if (!lastCheck) return true; // Never checked before

  const daysSinceLastCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastCheck >= 30;
}

/**
 * Get update history from SQLite
 */
export async function getUpdateHistory(): Promise<UpdateHistory[]> {
  return getSettingJson<UpdateHistory[]>(UPDATE_HISTORY_KEY, []);
}

/**
 * Add entry to update history
 */
export async function addToUpdateHistory(entry: UpdateHistory): Promise<void> {
  const history = await getUpdateHistory();
  history.unshift(entry); // Add to beginning

  // Keep only last 100 entries
  if (history.length > 100) {
    history.splice(100);
  }

  await setSettingJson(UPDATE_HISTORY_KEY, history);
}

/**
 * Query Perplexity Sonar API for current Australian brand names of a batch of medications.
 *
 * Uses a single API call with a structured prompt to get brand names for multiple
 * medications at once, reducing cost and latency vs. individual queries.
 */
async function queryPerplexityForBrands(
  medications: { genericName: string; category: string }[]
): Promise<{ results: Record<string, string[]>; sources: string[] }> {
  const apiKey = await getPerplexityApiKey();
  if (!apiKey) {
    throw new Error("Perplexity API key not configured. Set it in Settings > API Keys.");
  }

  const medList = medications
    .map((m, i) => `${i + 1}. ${m.genericName} (${m.category})`)
    .join("\n");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "You are a pharmaceutical research assistant. Return ONLY valid JSON with no markdown formatting, no code fences, and no explanation text. The JSON must be parseable by JSON.parse().",
        },
        {
          role: "user",
          content: `List the current brand names available in Australia for each of these medications. Include only brands currently sold in Australian pharmacies (e.g., Chemist Warehouse, Priceline Pharmacy, PBS-listed brands). Do not include discontinued brands.

Medications:
${medList}

Return a JSON object where each key is the generic drug name (exactly as listed above) and the value is an array of Australian brand name strings. Example format:
{"Fluoxetine": ["Lovan", "Prozac", "Auscap"], "Sertraline": ["Zoloft", "Sertra"]}

If a medication is only available as a generic/compounded formulation with no specific brand names in Australia, use an empty array [].`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error("Perplexity API key is invalid or expired. Check Settings > API Keys.");
    }
    throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || "";

  // Extract citations/sources if available
  const sources: string[] = data.citations || [];

  // Parse JSON from the response (handle potential markdown code fences)
  let parsed: Record<string, string[]>;
  try {
    // Try direct parse first
    parsed = JSON.parse(content);
  } catch {
    // Try extracting JSON from code fences
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim());
    } else {
      // Try finding first { to last }
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start !== -1 && end > start) {
        parsed = JSON.parse(content.substring(start, end + 1));
      } else {
        logger.error("Failed to parse Perplexity response:", content);
        throw new Error("Could not parse medication brands from API response");
      }
    }
  }

  // Validate structure: each value should be a string array
  const results: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      results[key] = value;
    }
  }

  return { results, sources };
}

/**
 * Compare current brands vs. proposed brands
 */
export function compareBrands(
  current: string[],
  proposed: string[]
): { additions: string[], removals: string[], unchanged: string[] } {
  const currentSet = new Set(current.map(b => b.toLowerCase()));
  const proposedSet = new Set(proposed.map(b => b.toLowerCase()));

  const additions = proposed.filter(b => !currentSet.has(b.toLowerCase()));
  const removals = current.filter(b => !proposedSet.has(b.toLowerCase()));
  const unchanged = current.filter(b => proposedSet.has(b.toLowerCase()));

  return { additions, removals, unchanged };
}

/**
 * Check for updates to all medications using Perplexity Sonar API.
 *
 * Batches medications into groups to minimize API calls while staying
 * within response size limits.
 */
export async function checkForMedicationUpdates(
  onProgress?: (current: number, total: number, medicationName: string) => void
): Promise<UpdateCheckResult> {
  const startTime = Date.now();
  const updates: MedicationUpdate[] = [];

  // Separate medications into searchable and compounded-only
  const searchable: typeof BEHAVIOR_MEDICATIONS = [];
  for (const med of BEHAVIOR_MEDICATIONS) {
    if (med.brandNames.includes('Compounded formulation')) {
      updates.push({
        medicationId: med.id,
        genericName: med.genericName,
        category: med.category,
        currentBrands: med.brandNames,
        proposedBrands: med.brandNames,
        additions: [],
        removals: [],
        unchanged: med.brandNames,
        sources: [],
        hasChanges: false,
      });
    } else {
      searchable.push(med);
    }
  }

  // Batch searchable medications into groups of 10
  const BATCH_SIZE = 10;
  const batches: typeof searchable[] = [];
  for (let i = 0; i < searchable.length; i += BATCH_SIZE) {
    batches.push(searchable.slice(i, i + BATCH_SIZE));
  }

  let processedCount = BEHAVIOR_MEDICATIONS.length - searchable.length; // compounded ones already done

  for (const batch of batches) {
    // Report progress for first medication in batch
    if (onProgress) {
      onProgress(processedCount + 1, BEHAVIOR_MEDICATIONS.length, batch[0].genericName);
    }

    try {
      const { results, sources } = await queryPerplexityForBrands(
        batch.map((m) => ({ genericName: m.genericName, category: m.category }))
      );

      for (const medication of batch) {
        processedCount++;
        if (onProgress) {
          onProgress(processedCount, BEHAVIOR_MEDICATIONS.length, medication.genericName);
        }

        // Find matching result (case-insensitive key match)
        const proposedBrands =
          results[medication.genericName] ||
          results[medication.genericName.toLowerCase()] ||
          Object.entries(results).find(
            ([key]) => key.toLowerCase() === medication.genericName.toLowerCase()
          )?.[1] ||
          [];

        // If Perplexity returned empty, keep current brands (avoid false removals)
        if (proposedBrands.length === 0) {
          updates.push({
            medicationId: medication.id,
            genericName: medication.genericName,
            category: medication.category,
            currentBrands: medication.brandNames,
            proposedBrands: medication.brandNames,
            additions: [],
            removals: [],
            unchanged: medication.brandNames,
            sources,
            hasChanges: false,
          });
          continue;
        }

        const { additions, removals, unchanged } = compareBrands(
          medication.brandNames,
          proposedBrands
        );

        updates.push({
          medicationId: medication.id,
          genericName: medication.genericName,
          category: medication.category,
          currentBrands: medication.brandNames,
          proposedBrands,
          additions,
          removals,
          unchanged,
          sources,
          hasChanges: additions.length > 0 || removals.length > 0,
        });
      }
    } catch (error) {
      logger.error("Perplexity batch query failed:", error);

      // Add all medications in the failed batch with no changes
      for (const medication of batch) {
        processedCount++;
        if (onProgress) {
          onProgress(processedCount, BEHAVIOR_MEDICATIONS.length, medication.genericName);
        }

        updates.push({
          medicationId: medication.id,
          genericName: medication.genericName,
          category: medication.category,
          currentBrands: medication.brandNames,
          proposedBrands: medication.brandNames,
          additions: [],
          removals: [],
          unchanged: medication.brandNames,
          sources: [],
          hasChanges: false,
        });
      }

      // If it's an auth error, throw immediately (don't continue with more batches)
      if (error instanceof Error && error.message.includes("API key")) {
        throw error;
      }
    }
  }

  const totalChanges = updates.filter(u => u.hasChanges).length;
  const checkDuration = Date.now() - startTime;

  // Update last check date
  await setLastUpdateCheckDate();

  return {
    updates,
    totalChanges,
    lastChecked: new Date(),
    checkDuration,
  };
}

/**
 * Apply selected medication updates to SQLite custom overrides
 */
export async function applyMedicationUpdates(
  selectedUpdates: { medicationId: string, newBrands: string[] }[]
): Promise<{ success: boolean, appliedCount: number, error?: string }> {
  try {
    const customBrands = await getSettingJson<Record<string, string[]>>('pbs_admin_custom_medication_brands', {});

    for (const update of selectedUpdates) {
      customBrands[update.medicationId] = update.newBrands;

      // Add to update history
      const medication = BEHAVIOR_MEDICATIONS.find(m => m.id === update.medicationId);
      if (medication) {
        const { additions, removals } = compareBrands(medication.brandNames, update.newBrands);

        for (const brand of additions) {
          await addToUpdateHistory({
            date: new Date().toISOString(),
            medicationId: update.medicationId,
            genericName: medication.genericName,
            changeType: 'addition',
            brandName: brand,
            appliedBy: 'user',
          });
        }

        for (const brand of removals) {
          await addToUpdateHistory({
            date: new Date().toISOString(),
            medicationId: update.medicationId,
            genericName: medication.genericName,
            changeType: 'removal',
            brandName: brand,
            appliedBy: 'user',
          });
        }
      }
    }

    await setSettingJson('pbs_admin_custom_medication_brands', customBrands);

    return {
      success: true,
      appliedCount: selectedUpdates.length,
    };

  } catch (error) {
    logger.error('Failed to apply medication updates:', error);
    return {
      success: false,
      appliedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get medication with custom brand names applied (if any)
 */
export async function getMedicationWithCustomBrands(medicationId: string): Promise<Medication | undefined> {
  const medication = BEHAVIOR_MEDICATIONS.find(m => m.id === medicationId);
  if (!medication) return undefined;

  const customBrands = await getSettingJson<Record<string, string[]>>('pbs_admin_custom_medication_brands', {});

  if (customBrands[medicationId]) {
    return {
      ...medication,
      brandNames: customBrands[medicationId],
    };
  }

  return medication;
}

/**
 * Clear all custom medication brand overrides
 */
export async function clearCustomMedicationBrands(): Promise<void> {
  await deleteSetting('pbs_admin_custom_medication_brands');
}
