// PBS Admin - Date Offset Utilities
// Calculate due dates from relative offset strings

import { formatISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Australia/Melbourne";

/**
 * Calculate due date from a base date and an offset string
 * @param baseDate - The consultation date (ISO 8601 string)
 * @param offset - Offset string like "3 days", "1 week", "48 hours"
 * @returns ISO 8601 date string in Australia/Melbourne timezone
 */
export function calculateDueDate(baseDate: string, offset: string): string {
  const date = new Date(baseDate);

  // Normalize offset string to lowercase for easier parsing
  const normalizedOffset = offset.toLowerCase().trim();

  // Parse different offset patterns
  if (normalizedOffset.includes('hour')) {
    const hours = parseInt(normalizedOffset);
    if (!isNaN(hours)) {
      date.setHours(date.getHours() + hours);
    }
  }
  else if (normalizedOffset.includes('day')) {
    const days = parseInt(normalizedOffset);
    if (!isNaN(days)) {
      date.setDate(date.getDate() + days);
    }
  }
  else if (normalizedOffset.includes('week')) {
    const weeks = parseInt(normalizedOffset);
    if (!isNaN(weeks)) {
      date.setDate(date.getDate() + (weeks * 7));
    }
  }
  else if (normalizedOffset.includes('month')) {
    const months = parseInt(normalizedOffset);
    if (!isNaN(months)) {
      date.setMonth(date.getMonth() + months);
    }
  }
  else {
    // If no recognized pattern, default to 1 week
    console.warn(`Unrecognized offset pattern: "${offset}", defaulting to 1 week`);
    date.setDate(date.getDate() + 7);
  }

  // Convert to Australia/Melbourne timezone and return as ISO string
  const zonedDate = toZonedTime(date, TIMEZONE);
  return formatISO(zonedDate);
}

/**
 * Validate offset string format
 * @param offset - Offset string to validate
 * @returns true if valid, false otherwise
 */
export function isValidOffset(offset: string): boolean {
  const normalizedOffset = offset.toLowerCase().trim();
  const validPatterns = ['hour', 'day', 'week', 'month'];

  // Check if offset contains a number and a valid time unit
  const hasNumber = /\d+/.test(normalizedOffset);
  const hasValidUnit = validPatterns.some(pattern => normalizedOffset.includes(pattern));

  return hasNumber && hasValidUnit;
}

/**
 * Parse offset string to display-friendly format
 * @param offset - Offset string like "3 days"
 * @returns Display string like "3 days" (normalized)
 */
export function formatOffset(offset: string): string {
  const normalizedOffset = offset.toLowerCase().trim();

  // Extract number and unit
  const match = normalizedOffset.match(/(\d+)\s*(\w+)/);
  if (!match) return offset;

  const [, number, unit] = match;

  // Singularize unit if number is 1
  let displayUnit = unit;
  if (parseInt(number) === 1) {
    displayUnit = unit.replace(/s$/, ''); // Remove trailing 's'
  }

  return `${number} ${displayUnit}`;
}
