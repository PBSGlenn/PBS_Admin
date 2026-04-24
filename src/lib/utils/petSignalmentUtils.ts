// PBS Admin - Pet Signalment Utilities
// Build authoritative signalment strings directly from the Pet DB record
// for use in client-facing reports. The transcript/clinical report must NOT
// be the source of truth for breed/sex/neuter status/age/weight — the
// structured pet record is.

import { calculateAge } from "./ageUtils";
import type { Pet } from "../types";

/**
 * Normalize the historical mess of `desexed` values in the DB into a tri-state.
 * Observed values: "Yes", "No", "Unknown", "Entire", "Intact", "1", "1.0",
 * "0", "0.0", "true", "false", null.
 */
function normalizeDesexed(desexed: string | null | undefined): "desexed" | "entire" | "unknown" {
  if (desexed == null) return "unknown";
  const d = String(desexed).trim().toLowerCase();
  if (!d) return "unknown";
  if (d === "yes" || d === "true" || d === "1" || d === "1.0") return "desexed";
  if (d === "no" || d === "false" || d === "0" || d === "0.0" || d === "entire" || d === "intact") return "entire";
  return "unknown";
}

/**
 * Format sex + desexed state for a client-facing report.
 *
 * Handles both the legacy combined `sex` column ("Male Neutered", "Female Spayed")
 * and the new split schema (sex="Male", desexed="Yes"). Returns null if nothing
 * useful can be said.
 */
export function formatSexAndDesexed(
  sex: string | null | undefined,
  desexed: string | null | undefined
): string | null {
  if (!sex) return null;
  const s = sex.trim();
  if (!s) return null;

  // Legacy combined values already spell out the neuter status — use verbatim.
  if (/\b(neutered|spayed|castrated)\b/i.test(s)) {
    return s;
  }

  const normalized = normalizeDesexed(desexed);
  const lower = s.toLowerCase();

  if (lower === "male") {
    if (normalized === "desexed") return "Male Neutered";
    if (normalized === "entire") return "Male Entire";
    return "Male";
  }
  if (lower === "female") {
    if (normalized === "desexed") return "Female Spayed";
    if (normalized === "entire") return "Female Entire";
    return "Female";
  }
  if (lower === "unknown") return null;

  return s;
}

/**
 * Format age with "approximately" prefix when DOB is flagged as approximate.
 * Returns e.g. "approximately 6 years old" or "2 years old".
 */
export function formatPetAge(
  dateOfBirth: string | null | undefined,
  dateOfBirthIsApproximate: number | null | undefined
): string | null {
  if (!dateOfBirth) return null;
  const age = calculateAge(dateOfBirth);
  if (!age || age === "Unknown") return null;
  const prefix = dateOfBirthIsApproximate ? "approximately " : "";
  return `${prefix}${age} old`;
}

function formatWeight(weightKg: number | null | undefined): string | null {
  if (weightKg == null || !Number.isFinite(weightKg)) return null;
  if (weightKg <= 0) return null;
  // Trim trailing zeros: 30.0 → "30", 16.5 → "16.5"
  const n = Number(weightKg);
  const str = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  return `${str} kg`;
}

/**
 * Build the one-line signalment for a single pet, sourced entirely from the
 * Pet DB record. Missing fields are simply omitted (no fabricated placeholders).
 *
 * Format: "Name — Breed, Sex/Neuter, approximately N years old, 30 kg"
 * (em-dash between name and details; commas between details)
 */
export function buildPetSignalment(pet: Pet): string {
  const details: string[] = [];

  if (pet.breed && pet.breed.trim()) {
    details.push(pet.breed.trim());
  }

  const sexDesexed = formatSexAndDesexed(pet.sex, pet.desexed);
  if (sexDesexed) details.push(sexDesexed);

  const age = formatPetAge(pet.dateOfBirth, pet.dateOfBirthIsApproximate);
  if (age) details.push(age);

  const weight = formatWeight(pet.weightKg);
  if (weight) details.push(weight);

  if (details.length === 0) {
    return pet.name;
  }
  return `${pet.name} — ${details.join(", ")}`;
}

/**
 * Build a multi-pet signalment block (one line per pet, newline-separated).
 */
export function buildSignalmentBlock(pets: Pet[]): string {
  return pets.map(buildPetSignalment).join("\n");
}
