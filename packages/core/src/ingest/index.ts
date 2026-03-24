import { consola } from "consola";
import type { RawItem } from "../normalize/index.js";
import type { SourceConfig, ProfileConfig } from "../types/index.js";
import { fetchRss } from "./rss.js";

export { fetchRss } from "./rss.js";
export type { RawItem } from "../normalize/index.js";

/**
 * Ingest items from all sources within the profile's lookback window.
 */
export async function ingest(
  profile: ProfileConfig,
  sources: SourceConfig[],
): Promise<RawItem[]> {
  const windowEnd = new Date();
  const windowStart = new Date(
    windowEnd.getTime() -
      profile.window.weekly_lookback_days * 24 * 60 * 60 * 1000,
  );

  consola.info(
    `[ingest] Window: ${windowStart.toISOString()} -> ${windowEnd.toISOString()} (${profile.window.weekly_lookback_days} days)`,
  );

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      switch (source.type) {
        case "rss":
          return fetchRss(source, windowStart, windowEnd);
        case "api":
        case "scrape":
          consola.warn(
            `[ingest] Source type "${source.type}" is not yet supported, skipping "${source.name}"`,
          );
          return [] as RawItem[];
        default:
          consola.warn(
            `[ingest] Unknown source type "${(source as SourceConfig).type}", skipping`,
          );
          return [] as RawItem[];
      }
    }),
  );

  const allItems: RawItem[] = [];
  let failed = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    } else {
      failed++;
      consola.warn(`[ingest] Source failed: ${result.reason}`);
    }
  }

  const succeeded = sources.length - failed;
  consola.info(
    `[ingest] Ingested ${allItems.length} items from ${succeeded} sources (${failed} failed)`,
  );

  return allItems;
}
