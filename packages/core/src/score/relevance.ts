import type { NormalizedItem } from "../types/index.js";

/**
 * Score relevance of an item against configured interest lists.
 * Checks title, text, and tags for case-insensitive keyword matches.
 * Returns a score between 0 and 1.
 */
export function scoreRelevance(
  item: NormalizedItem,
  includeInterests: string[],
  excludeInterests: string[],
): number {
  if (includeInterests.length === 0) {
    return 0.5; // neutral score when no interests configured
  }

  const corpus = buildCorpus(item);

  // Count include matches
  let includeMatches = 0;
  for (const interest of includeInterests) {
    if (matchesKeyword(corpus, interest)) {
      includeMatches++;
    }
  }

  // Base relevance from include matches as a proportion of total interests
  let score = includeMatches / includeInterests.length;

  // Count exclude matches and penalize
  if (excludeInterests.length > 0) {
    let excludeMatches = 0;
    for (const interest of excludeInterests) {
      if (matchesKeyword(corpus, interest)) {
        excludeMatches++;
      }
    }
    // Each exclude match reduces score by 0.2, floored at 0
    score = Math.max(0, score - excludeMatches * 0.2);
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Build a single lowercase string from the item's title, text, and tags
 * for efficient keyword matching.
 */
function buildCorpus(item: NormalizedItem): string {
  const parts = [item.title, item.text, ...item.tags];
  return parts.join(" ").toLowerCase();
}

/**
 * Case-insensitive keyword match. Supports multi-word phrases.
 * Uses word boundary matching for single words, substring match for phrases.
 */
function matchesKeyword(corpus: string, keyword: string): boolean {
  const lower = keyword.toLowerCase();
  // For single words, use word-boundary-aware matching
  if (!lower.includes(" ")) {
    const pattern = new RegExp(`\\b${escapeRegExp(lower)}\\b`);
    return pattern.test(corpus);
  }
  // For multi-word phrases, use simple substring matching
  return corpus.includes(lower);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
