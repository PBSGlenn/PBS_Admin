// PBS Admin - Validation Utilities

/**
 * Normalize mobile number (remove spaces, format consistently)
 */
export function normalizeMobile(mobile: string): string {
  // Remove all non-digit characters except +
  let cleaned = mobile.replace(/[^\d+]/g, "");

  // Convert +61 to 0
  if (cleaned.startsWith("+61")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("61") && cleaned.length === 11) {
    cleaned = "0" + cleaned.slice(2);
  }

  return cleaned;
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
