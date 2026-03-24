import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalize, type RawItem } from "../../src/normalize/index.js";
import { NormalizedItemSchema } from "../../src/types/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

async function loadRawItems(): Promise<RawItem[]> {
  const raw = await readFile(join(FIXTURES_DIR, "raw-items.json"), "utf-8");
  return JSON.parse(raw) as RawItem[];
}

describe("normalize()", () => {
  test("produces the correct number of normalized items", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    expect(result).toHaveLength(rawItems.length);
  });

  test("every output item validates against NormalizedItemSchema", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    for (const item of result) {
      const validation = NormalizedItemSchema.safeParse(item);
      expect(validation.success).toBe(true);
    }
  });

  test("generates deterministic IDs (same input produces same ID)", async () => {
    const rawItems = await loadRawItems();
    const result1 = await normalize(rawItems);
    const result2 = await normalize(rawItems);
    for (let i = 0; i < result1.length; i++) {
      expect(result1[i].id).toBe(result2[i].id);
    }
  });

  test("IDs are 16-character hex strings", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    for (const item of result) {
      expect(item.id).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  test("canonical URLs are set on every item", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    for (const item of result) {
      expect(item.canonical_url).toBeTruthy();
      expect(item.canonical_url.startsWith("https://")).toBe(true);
    }
  });

  test("content hashes are present and start with sha256:", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    for (const item of result) {
      expect(item.content_hash).toBeTruthy();
      expect(item.content_hash.startsWith("sha256:")).toBe(true);
    }
  });

  test("excerpts are truncated to at most 300 characters (plus ellipsis)", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    for (const item of result) {
      expect(item.excerpt).toBeTruthy();
      // Excerpt could end with "..." if truncated, total should be reasonable
      expect(item.excerpt.length).toBeLessThanOrEqual(303);
    }
  });

  test("preserves original URL alongside canonical URL", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    for (let i = 0; i < rawItems.length; i++) {
      expect(result[i].url).toBe(rawItems[i].url);
    }
  });

  test("propagates source metadata correctly", async () => {
    const rawItems = await loadRawItems();
    const result = await normalize(rawItems);
    for (let i = 0; i < rawItems.length; i++) {
      expect(result[i].source_id).toBe(rawItems[i].source_id);
      expect(result[i].source_name).toBe(rawItems[i].source_name);
      expect(result[i].source_type).toBe(rawItems[i].source_type);
      expect(result[i].title).toBe(rawItems[i].title);
      expect(result[i].tags).toEqual(rawItems[i].tags);
    }
  });

  test("defaults language to 'en' when not provided", async () => {
    const rawItem: RawItem = {
      source_id: "s1",
      source_name: "Source",
      source_type: "rss",
      title: "Test Article",
      url: "https://example.com/test",
      published_at: "2026-03-20T10:00:00Z",
      fetched_at: "2026-03-23T06:00:00Z",
      tags: [],
      text: "Some content for testing normalization pipeline.",
    };
    const result = await normalize([rawItem]);
    expect(result[0].language).toBe("en");
  });
});
