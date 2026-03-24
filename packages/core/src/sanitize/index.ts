import sanitize from "sanitize-html";

export { validateConfigPath, validateOutputPath } from "./paths.js";

/**
 * Strip all HTML tags properly using sanitize-html.
 * Replaces the naive regex approach in rss.ts.
 */
export function stripHtml(html: string): string {
  return sanitize(html, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

/**
 * Remove control characters and null bytes from text.
 * Preserves newlines and tabs.
 */
export function sanitizeText(text: string): string {
  // Remove null bytes
  let cleaned = text.replace(/\0/g, "");
  // Remove control chars except \n, \r, \t
  cleaned = cleaned.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned;
}

/**
 * Escape {{variable}} markers in untrusted content to prevent
 * template injection when the content is substituted into prompts.
 */
export function escapeTemplateVars(text: string): string {
  return text.replace(/\{\{/g, "{ {").replace(/\}\}/g, "} }");
}

/**
 * Escape Slack mrkdwn special characters in untrusted content.
 * Prevents formatting injection in Slack messages.
 */
export function escapeSlackMrkdwn(text: string): string {
  // Escape: * (bold), _ (italic), ~ (strikethrough), ` (code), > (blockquote)
  // Also escape < > to prevent link/mention injection
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Validate and sanitize a string for use as a filesystem path component.
 * Removes path traversal characters and special filesystem chars.
 */
export function sanitizePathComponent(input: string): string {
  return input
    .replace(/\.\./g, "")        // Remove path traversal
    .replace(/[/\\:*?"<>|\0]/g, "")  // Remove filesystem-unsafe chars
    .replace(/^\.+/, "")         // No leading dots
    .slice(0, 255);              // Filesystem name length limit
}

/**
 * Validate date format strictly (YYYY-MM-DD).
 * Returns the validated date or throws.
 */
export function validateDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: "${date}" (expected YYYY-MM-DD)`);
  }
  const [y, m, d] = date.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    throw new Error(`Invalid date values: "${date}"`);
  }
  return date;
}

/**
 * Wrap untrusted content with boundary markers for LLM prompts.
 * Makes it explicit to the LLM which content is external/untrusted.
 */
export function wrapUntrustedContent(fieldName: string, value: string): string {
  const escaped = escapeTemplateVars(sanitizeText(value));
  return `<source_data field="${fieldName}">\n${escaped}\n</source_data>`;
}
