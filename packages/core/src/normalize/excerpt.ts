const DEFAULT_MAX_LENGTH = 300;

export function extractExcerpt(text: string, maxLength?: number): string {
  const limit = maxLength ?? DEFAULT_MAX_LENGTH;

  // Strip extra whitespace: collapse runs of whitespace into single spaces, trim
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= limit) {
    return cleaned;
  }

  // Try to break at a sentence boundary within the limit
  const truncated = cleaned.slice(0, limit);

  // Look for the last sentence-ending punctuation followed by a space
  const sentenceEnd = truncated.search(/[.!?]\s[^.!?]*$/);
  if (sentenceEnd !== -1) {
    return truncated.slice(0, sentenceEnd + 1) + "...";
  }

  // Fall back to breaking at the last space
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > limit * 0.5) {
    return truncated.slice(0, lastSpace) + "...";
  }

  // Last resort: hard truncate
  return truncated + "...";
}
