import Parser from "rss-parser";
import { consola } from "consola";
import type { RawItem } from "../normalize/index.js";
import type { SourceConfig } from "../types/index.js";

const parser = new Parser();

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Fetch an RSS feed and return items within the given time window.
 */
export async function fetchRss(
  source: SourceConfig,
  windowStart: Date,
  windowEnd: Date,
): Promise<RawItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    const fetchedAt = new Date().toISOString();

    const items: RawItem[] = [];

    for (const item of feed.items) {
      const dateStr = item.isoDate ?? item.pubDate;
      if (!dateStr) {
        consola.debug(
          `[rss] Skipping item without date: "${item.title}" from ${source.name}`,
        );
        continue;
      }

      const publishedDate = new Date(dateStr);
      if (publishedDate < windowStart || publishedDate > windowEnd) {
        continue;
      }

      const rawText = item.contentSnippet ?? item.content ?? "";

      items.push({
        source_id: source.id,
        source_name: source.name,
        source_type: source.type,
        title: item.title ?? "",
        url: item.link ?? "",
        published_at: publishedDate.toISOString(),
        fetched_at: fetchedAt,
        author: item.creator ?? item.author,
        tags: source.tags ?? [],
        text: stripHtml(rawText),
        language: "en",
      });
    }

    consola.info(`[rss] Fetched ${items.length} items from ${source.name}`);
    return items;
  } catch (err) {
    consola.warn(
      `[rss] Failed to fetch ${source.name} (${source.url}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}
