/**
 * Security and sanitization utilities for B-Map Navigation Platform.
 */

/**
 * Escapes characters with special meaning in Regular Expressions.
 * Prevents ReDoS (Regular Expression Denial of Service) and regex injection.
 */
export const escapeRegExp = (str: string): string => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Sanitizes input strings by escaping HTML entities to prevent Stored & Reflected XSS.
 */
export const escapeHtml = (unsafe: string): string => {
  if (!unsafe || typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
