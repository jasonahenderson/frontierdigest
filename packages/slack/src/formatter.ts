/**
 * Utility functions for formatting text for Slack messages.
 */

/**
 * Truncate text to a maximum length, appending an ellipsis if truncated.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "\u2026";
}

/**
 * Format an ISO date string as a human-readable date, e.g. "March 23, 2026".
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Return the singular or plural form of a word based on count.
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  if (count === 1) return singular;
  return plural ?? singular + "s";
}
