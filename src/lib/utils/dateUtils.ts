// PBS Admin - Date Utility Functions
// All dates are displayed in Australia/Melbourne timezone

import { format, parseISO, isAfter, isBefore, addDays, subDays, differenceInDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { TIMEZONE, DATE_FORMATS } from "../constants";
import { logger } from "./logger";

/**
 * Convert a Date object to an ISO 8601 string in the Australia/Melbourne timezone
 * Use this when storing dates in the database
 */
export function dateToISO(date: Date): string {
  const zonedDate = toZonedTime(date, TIMEZONE);
  return zonedDate.toISOString();
}

/**
 * Parse an ISO 8601 string and convert to Australia/Melbourne timezone
 * Use this when displaying dates from the database
 */
export function parseDate(isoString: string): Date {
  return toZonedTime(parseISO(isoString), TIMEZONE);
}

/**
 * Get the current date/time in Australia/Melbourne timezone
 */
export function now(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Format a date string for display in the UI
 */
export function formatDate(isoString: string, formatString: string = DATE_FORMATS.DISPLAY_DATE): string {
  try {
    const date = parseDate(isoString);
    return format(date, formatString);
  } catch (error) {
    logger.error("Error formatting date:", error);
    return isoString;
  }
}

/**
 * Format a date object for display in the UI
 */
export function formatDateObject(date: Date, formatString: string = DATE_FORMATS.DISPLAY_DATE): string {
  try {
    const zonedDate = toZonedTime(date, TIMEZONE);
    return format(zonedDate, formatString);
  } catch (error) {
    logger.error("Error formatting date object:", error);
    return date.toISOString();
  }
}

/**
 * Format a date/time string for display with time
 */
export function formatDateTime(isoString: string): string {
  return formatDate(isoString, DATE_FORMATS.DISPLAY_DATETIME);
}

/**
 * Format a date/time string for display with full details
 */
export function formatDateTimeLong(isoString: string): string {
  return formatDate(isoString, DATE_FORMATS.DISPLAY_DATETIME_LONG);
}

/**
 * Check if a date is in the past
 */
export function isPast(isoString: string): boolean {
  try {
    const date = parseDate(isoString);
    return isBefore(date, now());
  } catch (error) {
    logger.error("Error checking if date is past:", error);
    return false;
  }
}

/**
 * Check if a date is in the future
 */
export function isFuture(isoString: string): boolean {
  try {
    const date = parseDate(isoString);
    return isAfter(date, now());
  } catch (error) {
    logger.error("Error checking if date is future:", error);
    return false;
  }
}

/**
 * Check if a task is overdue (due date is in the past and status is not Done or Canceled)
 */
export function isTaskOverdue(dueDate: string, status: string): boolean {
  if (status === "Done" || status === "Canceled") {
    return false;
  }
  return isPast(dueDate);
}

/**
 * Add days to a date string and return ISO string
 */
export function addDaysToDate(isoString: string, days: number): string {
  const date = parseDate(isoString);
  const newDate = addDays(date, days);
  return dateToISO(newDate);
}

/**
 * Subtract days from a date string and return ISO string
 */
export function subtractDaysFromDate(isoString: string, days: number): string {
  const date = parseDate(isoString);
  const newDate = subDays(date, days);
  return dateToISO(newDate);
}

/**
 * Calculate the number of days between two dates
 */
export function daysBetween(isoString1: string, isoString2: string): number {
  const date1 = parseDate(isoString1);
  const date2 = parseDate(isoString2);
  return differenceInDays(date2, date1);
}

/**
 * Create a date for the questionnaire check task (48 hours before event)
 */
export function createQuestionnaireCheckDate(eventDateISO: string): string {
  return subtractDaysFromDate(eventDateISO, 2);
}

/**
 * Convert a user-entered date (from date picker) to ISO string
 * Assumes the user is entering dates in Australia/Melbourne timezone
 */
export function userInputToISO(date: Date): string {
  // The date picker gives us a local Date object
  // We need to interpret it as Australia/Melbourne time
  const zonedDate = fromZonedTime(date, TIMEZONE);
  return zonedDate.toISOString();
}

/**
 * Convert an ISO string to a Date object for use in date pickers
 * Interprets the ISO string as Australia/Melbourne time
 */
export function isoToUserInput(isoString: string): Date {
  const zonedDate = toZonedTime(parseISO(isoString), TIMEZONE);
  // Return as a local Date for the date picker
  return new Date(
    zonedDate.getFullYear(),
    zonedDate.getMonth(),
    zonedDate.getDate(),
    zonedDate.getHours(),
    zonedDate.getMinutes()
  );
}

/**
 * Get a relative time string (e.g., "2 days ago", "in 3 hours")
 */
export function getRelativeTime(isoString: string): string {
  const date = parseDate(isoString);
  const currentDate = now();
  const days = differenceInDays(date, currentDate);

  if (days === 0) {
    return "Today";
  } else if (days === 1) {
    return "Tomorrow";
  } else if (days === -1) {
    return "Yesterday";
  } else if (days > 1 && days <= 7) {
    return `In ${days} days`;
  } else if (days < -1 && days >= -7) {
    return `${Math.abs(days)} days ago`;
  } else if (days > 7) {
    return formatDate(isoString);
  } else {
    return formatDate(isoString);
  }
}

/**
 * Format a date for display in tables (shorter format)
 */
export function formatDateShort(isoString: string): string {
  return formatDate(isoString, "dd/MM/yy");
}

/**
 * Format time only
 */
export function formatTime(isoString: string): string {
  return formatDate(isoString, DATE_FORMATS.DISPLAY_TIME);
}

/**
 * Get today's date as ISO string (start of day in Melbourne time)
 */
export function todayISO(): string {
  const today = now();
  today.setHours(0, 0, 0, 0);
  return dateToISO(today);
}

/**
 * Get start of day for a given ISO date
 */
export function startOfDay(isoString: string): string {
  const date = parseDate(isoString);
  date.setHours(0, 0, 0, 0);
  return dateToISO(date);
}

/**
 * Get end of day for a given ISO date
 */
export function endOfDay(isoString: string): string {
  const date = parseDate(isoString);
  date.setHours(23, 59, 59, 999);
  return dateToISO(date);
}
