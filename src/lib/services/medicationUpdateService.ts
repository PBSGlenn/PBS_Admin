// Medication Update Service
// Automated web search for current medication brand names

import { BEHAVIOR_MEDICATIONS, Medication } from '../medications';
import { getSetting, setSetting, getSettingJson, setSettingJson, deleteSetting } from './settingsService';

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
 * Search for current brand names for a specific medication
 * Uses web search to find authoritative Australian sources
 *
 * Search Strategy:
 * 1. Chemist Warehouse - Primary source for current Australian market availability
 * 2. PBS.gov.au - Government pharmaceutical benefits scheme
 * 3. healthdirect.gov.au - Government health information
 */
export async function searchMedicationBrands(
  genericName: string,
  category: string
): Promise<{ brands: string[], sources: string[] }> {
  // Note: This is a placeholder for web search integration
  // In production, this would use the WebSearch tool or API

  const sources = [
    'https://www.chemistwarehouse.com.au',
    'https://www.pbs.gov.au',
    'https://www.healthdirect.gov.au'
  ];

  // Search queries for each source
  const searchQueries = {
    chemistWarehouse: `site:chemistwarehouse.com.au ${genericName}`,
    pbs: `site:pbs.gov.au ${genericName} brand names`,
    healthdirect: `site:healthdirect.gov.au ${genericName} brands`
  };

  // TODO: Integrate with WebSearch tool
  // 1. Search Chemist Warehouse for product listings
  // 2. Search PBS for official brand registrations
  // 3. Search healthdirect for additional brands
  // 4. Parse and combine results
  // 5. Deduplicate and validate brand names

  // For now, return current brands (no changes detected)
  const currentMed = BEHAVIOR_MEDICATIONS.find(m => m.genericName === genericName);

  return {
    brands: currentMed?.brandNames || [],
    sources
  };
}

/**
 * Parse search results and extract brand names
 * This function would parse HTML/text from:
 * - Chemist Warehouse (product listings)
 * - PBS.gov.au (official registrations)
 * - healthdirect.gov.au (health information)
 */
export function parseBrandNamesFromSearchResults(searchResults: string): string[] {
  // TODO: Implement HTML parsing logic
  // Look for common patterns:
  // - "Available as: [brand1], [brand2], [brand3]"
  // - Brand names in <li> tags
  // - Table rows with brand names

  const brands: string[] = [];

  // Example regex patterns (would need refinement)
  const patterns = [
    /brand names?:?\s*([^.]+)/gi,
    /available as:?\s*([^.]+)/gi,
    /marketed as:?\s*([^.]+)/gi,
  ];

  patterns.forEach(pattern => {
    const matches = searchResults.matchAll(pattern);
    for (const match of matches) {
      const brandList = match[1];
      const extractedBrands = brandList
        .split(/,|and|\||;/)
        .map(b => b.trim())
        .filter(b => b.length > 0 && b.length < 50); // Reasonable brand name length
      brands.push(...extractedBrands);
    }
  });

  // Remove duplicates and common false positives
  return Array.from(new Set(brands))
    .filter(b => !['the', 'or', 'available', 'brand'].includes(b.toLowerCase()));
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
 * Check for updates to all medications
 * This is the main function that runs monthly
 */
export async function checkForMedicationUpdates(
  onProgress?: (current: number, total: number, medicationName: string) => void
): Promise<UpdateCheckResult> {
  const startTime = Date.now();
  const updates: MedicationUpdate[] = [];

  for (let i = 0; i < BEHAVIOR_MEDICATIONS.length; i++) {
    const medication = BEHAVIOR_MEDICATIONS[i];

    // Report progress
    if (onProgress) {
      onProgress(i + 1, BEHAVIOR_MEDICATIONS.length, medication.genericName);
    }

    // Skip compounded-only medications (no brand names to update)
    if (medication.brandNames.includes('Compounded formulation')) {
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
      continue;
    }

    try {
      // Search for current brand names
      const { brands: proposedBrands, sources } = await searchMedicationBrands(
        medication.genericName,
        medication.category
      );

      // Compare current vs. proposed
      const { additions, removals, unchanged } = compareBrands(
        medication.brandNames,
        proposedBrands
      );

      updates.push({
        medicationId: medication.id,
        genericName: medication.genericName,
        category: medication.category,
        currentBrands: medication.brandNames,
        proposedBrands: proposedBrands,
        additions,
        removals,
        unchanged,
        sources,
        hasChanges: additions.length > 0 || removals.length > 0,
      });

      // Small delay to avoid rate limiting (if using real web search)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`Failed to check updates for ${medication.genericName}:`, error);

      // Add entry with error state
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
 * Apply selected medication updates
 * This would modify the medications.ts file (in production, would regenerate the file)
 */
export async function applyMedicationUpdates(
  selectedUpdates: { medicationId: string, newBrands: string[] }[]
): Promise<{ success: boolean, appliedCount: number, error?: string }> {
  try {
    // In a production app, this would:
    // 1. Read the medications.ts file
    // 2. Parse and update the BEHAVIOR_MEDICATIONS array
    // 3. Write the updated file back to disk
    // 4. Trigger a hot reload or app restart

    // For now, we'll update SQLite with custom overrides
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
    console.error('Failed to apply medication updates:', error);
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
