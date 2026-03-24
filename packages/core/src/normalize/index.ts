import { NormalizedItemSchema } from "../types/index.js";
import type { NormalizedItem } from "../types/index.js";
import { canonicalizeUrl } from "./url-canonical.js";
import { contentHash } from "./content-hash.js";
import { extractExcerpt } from "./excerpt.js";
import { escapeTemplateVars, sanitizeText } from "../sanitize/index.js";

export { canonicalizeUrl } from "./url-canonical.js";
export { contentHash } from "./content-hash.js";
export { extractExcerpt } from "./excerpt.js";

export interface RawItem {
  source_id: string;
  source_name: string;
  source_type: "rss" | "api" | "scrape";
  title: string;
  url: string;
  published_at: string;
  fetched_at: string;
  author?: string;
  tags: string[];
  text: string;
  language?: string;
}

/**
 * Generate a deterministic ID from source_id, canonical URL, and date.
 */
async function generateId(
  sourceId: string,
  canonicalUrl: string,
  publishedAt: string,
): Promise<string> {
  const input = `${sourceId}|${canonicalUrl}|${publishedAt}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function normalize(items: RawItem[]): Promise<NormalizedItem[]> {
  const results: NormalizedItem[] = [];

  for (const item of items) {
    try {
      const canonical_url = canonicalizeUrl(item.url);
      const id = await generateId(
        item.source_id,
        canonical_url,
        item.published_at,
      );
      const hash = await contentHash(item.text);
      const excerpt = extractExcerpt(item.text);

      const sanitizedTitle = escapeTemplateVars(sanitizeText(item.title));
      const sanitizedText = escapeTemplateVars(sanitizeText(item.text));
      const sanitizedExcerpt = escapeTemplateVars(sanitizeText(excerpt));

      const normalized = NormalizedItemSchema.parse({
        id,
        source_id: item.source_id,
        source_name: item.source_name,
        source_type: item.source_type,
        title: sanitizedTitle,
        url: item.url,
        canonical_url,
        published_at: item.published_at,
        fetched_at: item.fetched_at,
        author: item.author,
        tags: item.tags,
        text: sanitizedText,
        excerpt: sanitizedExcerpt,
        content_hash: hash,
        language: item.language ?? "en",
      });

      results.push(normalized);
    } catch (err) {
      console.warn(
        `[normalize] Skipping item "${item.title}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return results;
}
