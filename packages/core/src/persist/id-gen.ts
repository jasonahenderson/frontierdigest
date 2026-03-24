import { createHash } from "node:crypto";

/**
 * Deterministic item ID based on source, url, and date.
 */
export function generateItemId(
  sourceId: string,
  url: string,
  date: string,
): string {
  const hash = createHash("sha256")
    .update(`${sourceId}:${url}:${date}`)
    .digest("hex")
    .slice(0, 12);
  return `item_${hash}`;
}

/**
 * Digest ID for a given date, e.g. "weekly_2026_03_23".
 */
export function generateDigestId(date: string): string {
  const slug = date.replace(/-/g, "_");
  return `weekly_${slug}`;
}

/**
 * Run ID for a given date, e.g. "run_2026_03_23_weekly_01".
 * The increment parameter allows callers to disambiguate multiple runs on the same day.
 */
export function generateRunId(date: string, increment: number = 1): string {
  const slug = date.replace(/-/g, "_");
  const seq = String(increment).padStart(2, "0");
  return `run_${slug}_weekly_${seq}`;
}

/**
 * Topic pack ID for a given topic key and date.
 */
export function generateTopicId(topicKey: string, date: string): string {
  const slug = date.replace(/-/g, "_");
  return `topic_${topicKey}_${slug}`;
}
