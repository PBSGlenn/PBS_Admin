// PBS Admin - General Utility Functions

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence
 * Used throughout the app for conditional styling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a name (first + last)
 */
export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Format a phone number for display
 */
export function formatPhone(mobile: string): string {
  // Remove all non-digit characters
  const cleaned = mobile.replace(/\D/g, "");

  // Format as: 0412 345 678
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Format with +61: +61 412 345 678
  if (cleaned.length === 11 && cleaned.startsWith("61")) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }

  // Return as-is if format doesn't match
  return mobile;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Format address for display
 */
export function formatAddress(
  streetAddress?: string | null,
  city?: string | null,
  state?: string | null,
  postcode?: string | null
): string {
  const parts = [streetAddress, city, state, postcode].filter(Boolean);
  return parts.join(", ");
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random ID (for optimistic updates)
 */
export function generateTempId(): number {
  return -Math.floor(Math.random() * 1000000);
}

/**
 * Check if a value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Sort by field helper
 */
export function sortBy<T>(
  array: T[],
  field: keyof T,
  direction: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === bVal) return 0;

    let comparison = 0;
    if (aVal === null || aVal === undefined) {
      comparison = 1;
    } else if (bVal === null || bVal === undefined) {
      comparison = -1;
    } else if (aVal < bVal) {
      comparison = -1;
    } else {
      comparison = 1;
    }

    return direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Filter by search query (case-insensitive, multiple fields)
 */
export function filterBySearch<T>(
  array: T[],
  query: string,
  fields: (keyof T)[]
): T[] {
  if (!query.trim()) return array;

  const lowerQuery = query.toLowerCase();

  return array.filter((item) => {
    return fields.some((field) => {
      const value = item[field];
      if (typeof value === "string") {
        return value.toLowerCase().includes(lowerQuery);
      }
      return false;
    });
  });
}

/**
 * Group array by field
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Get priority color for tasks
 */
export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1:
      return "red";
    case 2:
      return "orange";
    case 3:
      return "yellow";
    case 4:
      return "blue";
    case 5:
      return "gray";
    default:
      return "gray";
  }
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "Pending":
      return "gray";
    case "InProgress":
      return "blue";
    case "Blocked":
      return "red";
    case "Done":
      return "green";
    case "Canceled":
      return "gray";
    default:
      return "gray";
  }
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}
