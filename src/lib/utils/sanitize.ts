// PBS Admin - HTML Sanitization Utilities
// Prevents XSS attacks when handling HTML content

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Allows basic formatting tags but removes scripts, event handlers, etc.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    // Allow common formatting tags used by Tiptap
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'span', 'div',
      'hr',
    ],
    // Allow common attributes
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'class', 'style',
      'data-*',
    ],
    // Don't allow javascript: URLs
    ALLOW_DATA_ATTR: true,
    // Allow safe URI schemes only
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Strip all HTML tags and return plain text
 * Safe alternative to using innerHTML for text extraction
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  // First sanitize, then extract text
  const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });

  // DOMPurify with no allowed tags returns text content
  return sanitized;
}

/**
 * Sanitize and truncate HTML for display in tables
 */
export function truncateHtml(html: string | null | undefined, maxLength: number = 50): string {
  if (!html) return '—';

  const plainText = stripHtml(html);
  return plainText.length > maxLength
    ? plainText.substring(0, maxLength) + '...'
    : plainText;
}
