import type { NormalizedItem } from "../types/index.js";

/**
 * Score cross-source reinforcement: how many OTHER sources cover similar content.
 *
 * Similarity is determined by title similarity (word overlap) or matching tags.
 * Normalized to 0-1 scale: 0 = unique to one source, 1 = covered by 5+ sources.
 * Uses a linear scale capped at 5 distinct sources.
 */
export function scoreReinforcement(
  item: NormalizedItem,
  allItems: NormalizedItem[],
): number {
  const matchingSources = new Set<string>();

  const itemTitleWords = extractSignificantWords(item.title);
  const itemTags = new Set(item.tags.map((t) => t.toLowerCase()));

  for (const other of allItems) {
    // Skip same item or same source
    if (other.id === item.id || other.source_id === item.source_id) {
      continue;
    }

    // Already counted this source
    if (matchingSources.has(other.source_id)) {
      continue;
    }

    if (isSimilar(itemTitleWords, itemTags, other)) {
      matchingSources.add(other.source_id);
    }
  }

  // Linear scale: 0 sources = 0, 5+ sources = 1.0
  const count = matchingSources.size;
  return Math.min(1, count / 5);
}

/**
 * Determine if two items are similar based on title word overlap or shared tags.
 */
function isSimilar(
  titleWords: Set<string>,
  tags: Set<string>,
  other: NormalizedItem,
): boolean {
  // Check tag overlap: if any tags match, consider similar
  if (tags.size > 0) {
    for (const tag of other.tags) {
      if (tags.has(tag.toLowerCase())) {
        return true;
      }
    }
  }

  // Check title similarity via word overlap
  const otherWords = extractSignificantWords(other.title);
  if (titleWords.size === 0 || otherWords.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const word of titleWords) {
    if (otherWords.has(word)) {
      overlap++;
    }
  }

  // Require at least 40% word overlap relative to the smaller title
  const minSize = Math.min(titleWords.size, otherWords.size);
  return overlap / minSize >= 0.4;
}

/** Common English stop words to exclude from similarity comparison. */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "was", "are", "be",
  "has", "had", "have", "this", "that", "will", "can", "how", "what",
  "why", "when", "where", "who", "new", "not", "no", "its", "about",
]);

/**
 * Extract significant (non-stop) words from a title, lowercased.
 */
function extractSignificantWords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}
