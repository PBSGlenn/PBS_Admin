// PBS Admin - Validation Utilities

import { VALIDATION_PATTERNS, VALIDATION_MESSAGES } from "../constants";
import type { ValidationError, ClientInput, PetInput, EventInput, TaskInput } from "../types";

/**
 * Validate email format
 */
export function validateEmail(email: string): string | null {
  if (!email) return VALIDATION_MESSAGES.REQUIRED;
  if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
    return VALIDATION_MESSAGES.EMAIL_INVALID;
  }
  return null;
}

/**
 * Validate Australian mobile number
 */
export function validateMobile(mobile: string): string | null {
  if (!mobile) return VALIDATION_MESSAGES.REQUIRED;
  if (!VALIDATION_PATTERNS.MOBILE_AU.test(mobile)) {
    return VALIDATION_MESSAGES.MOBILE_INVALID;
  }
  return null;
}

/**
 * Validate Australian postcode
 */
export function validatePostcode(postcode: string): string | null {
  if (!postcode) return null; // Optional field
  if (!VALIDATION_PATTERNS.POSTCODE_AU.test(postcode)) {
    return VALIDATION_MESSAGES.POSTCODE_INVALID;
  }
  return null;
}

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName: string = "This field"): string | null {
  if (value === null || value === undefined || value === "") {
    return `${fieldName} is required`;
  }
  return null;
}

/**
 * Validate Client input
 */
export function validateClient(client: Partial<ClientInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!client.firstName?.trim()) {
    errors.push({ field: "firstName", message: "First name is required" });
  }

  if (!client.lastName?.trim()) {
    errors.push({ field: "lastName", message: "Last name is required" });
  }

  // Email validation
  const emailError = validateEmail(client.email || "");
  if (emailError) {
    errors.push({ field: "email", message: emailError });
  }

  // Mobile validation
  const mobileError = validateMobile(client.mobile || "");
  if (mobileError) {
    errors.push({ field: "mobile", message: mobileError });
  }

  // Postcode validation (optional)
  if (client.postcode) {
    const postcodeError = validatePostcode(client.postcode);
    if (postcodeError) {
      errors.push({ field: "postcode", message: postcodeError });
    }
  }

  return errors;
}

/**
 * Validate Pet input
 */
export function validatePet(pet: Partial<PetInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!pet.name?.trim()) {
    errors.push({ field: "name", message: "Pet name is required" });
  }

  if (!pet.species?.trim()) {
    errors.push({ field: "species", message: "Species is required" });
  }

  return errors;
}

/**
 * Validate Event input
 */
export function validateEvent(event: Partial<EventInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!event.eventType) {
    errors.push({ field: "eventType", message: "Event type is required" });
  }

  if (!event.date) {
    errors.push({ field: "date", message: "Date is required" });
  }

  return errors;
}

/**
 * Validate Task input
 */
export function validateTask(task: Partial<TaskInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!task.description?.trim()) {
    errors.push({ field: "description", message: "Description is required" });
  }

  if (!task.dueDate) {
    errors.push({ field: "dueDate", message: "Due date is required" });
  }

  if (!task.status) {
    errors.push({ field: "status", message: "Status is required" });
  }

  if (task.priority !== undefined && (task.priority < 1 || task.priority > 5)) {
    errors.push({ field: "priority", message: "Priority must be between 1 and 5" });
  }

  return errors;
}

/**
 * Check if there are any validation errors
 */
export function hasErrors(errors: ValidationError[]): boolean {
  return errors.length > 0;
}

/**
 * Get error message for a specific field
 */
export function getFieldError(errors: ValidationError[], field: string): string | null {
  const error = errors.find((e) => e.field === field);
  return error?.message || null;
}

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
