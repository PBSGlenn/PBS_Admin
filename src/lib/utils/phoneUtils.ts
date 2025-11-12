// PBS Admin - Phone Number Utility Functions
// Formats phone numbers for Australian mobile format

/**
 * Format a phone number to Australian mobile format: xxxx xxx xxx
 * Removes all non-digit characters and formats to 10 digits
 */
export function formatAustralianMobile(value: string): string {
  // Remove all non-digit characters
  const digitsOnly = value.replace(/\D/g, '');

  // Format as xxxx xxx xxx
  if (digitsOnly.length <= 4) {
    return digitsOnly;
  } else if (digitsOnly.length <= 7) {
    return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4)}`;
  } else {
    return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7, 10)}`;
  }
}

/**
 * Get raw phone number without formatting (digits only)
 */
export function getRawPhoneNumber(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

/**
 * Validate Australian mobile number
 * Must start with 04 and be 10 digits total
 */
export function isValidAustralianMobile(value: string): boolean {
  const digitsOnly = getRawPhoneNumber(value);
  return /^04\d{8}$/.test(digitsOnly);
}
