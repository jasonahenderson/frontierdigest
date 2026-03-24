import type { ScoredItem } from "../types/index.js";

/**
 * Generate a fallback label for a cluster without using an LLM.
 *
 * Strategy:
 * - Use the highest-scored item's title as the base
 * - Extract common tags across items
 * - If 3+ items share a tag, incorporate that tag into the label
 */
export function fallbackLabel(items: ScoredItem[]): {
  label: string;
  tags: string[];
} {
  if (items.length === 0) {
    return { label: "Uncategorized", tags: [] };
  }

  // Find the highest-scored item
  const sorted = [...items].sort((a, b) => b.total_score - a.total_score);
  const topItem = sorted[0];

  // Count tag frequency across cluster members
  const tagCounts = new Map<string, number>();
  for (const item of items) {
    const seen = new Set<string>();
    for (const tag of item.item.tags) {
      const normalized = tag.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }
  }

  // Tags shared by at least 2 members
  const commonTags = [...tagCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  // Tags shared by 3+ items get incorporated into the label
  const prominentTags = [...tagCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  let label: string;
  if (prominentTags.length > 0 && items.length > 1) {
    // Use prominent tags as a thematic prefix
    const tagPrefix = prominentTags
      .slice(0, 3)
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(", ");
    label = `${tagPrefix}: ${topItem.item.title}`;
  } else {
    label = topItem.item.title;
  }

  return { label, tags: commonTags };
}

/**
 * Convert a label to a URL-safe topic key.
 * Lowercase, hyphens for spaces, strip special characters.
 */
export function generateTopicKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
