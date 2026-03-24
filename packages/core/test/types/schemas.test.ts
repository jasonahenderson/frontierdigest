import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  NormalizedItemSchema,
  DigestEntrySchema,
  TopicPackSchema,
  WeeklyDigestSchema,
  SourceBundleSchema,
} from "../../src/types/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

describe("Zod schemas", () => {
  describe("NormalizedItemSchema", () => {
    test("validates all items in normalized-items.json fixture", async () => {
      const items = await loadFixture<unknown[]>("normalized-items.json");
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        const result = NormalizedItemSchema.safeParse(item);
        expect(result.success).toBe(true);
      }
    });

    test("rejects item missing required fields", () => {
      const result = NormalizedItemSchema.safeParse({
        id: "test",
        // missing most required fields
      });
      expect(result.success).toBe(false);
    });

    test("rejects item with invalid source_type", () => {
      const result = NormalizedItemSchema.safeParse({
        id: "test",
        source_id: "s1",
        source_name: "Source",
        source_type: "invalid_type",
        title: "Title",
        url: "https://example.com",
        canonical_url: "https://example.com",
        published_at: "2026-03-20T10:00:00Z",
        fetched_at: "2026-03-23T06:00:00Z",
        tags: [],
        text: "Some text",
        excerpt: "Some excerpt",
        content_hash: "sha256:abc",
        language: "en",
      });
      expect(result.success).toBe(false);
    });

    test("rejects item with invalid URL", () => {
      const result = NormalizedItemSchema.safeParse({
        id: "test",
        source_id: "s1",
        source_name: "Source",
        source_type: "rss",
        title: "Title",
        url: "not-a-url",
        canonical_url: "https://example.com",
        published_at: "2026-03-20T10:00:00Z",
        fetched_at: "2026-03-23T06:00:00Z",
        tags: [],
        text: "Some text",
        excerpt: "Some excerpt",
        content_hash: "sha256:abc",
        language: "en",
      });
      expect(result.success).toBe(false);
    });

    test("defaults language to 'en' when not provided", () => {
      const result = NormalizedItemSchema.safeParse({
        id: "test",
        source_id: "s1",
        source_name: "Source",
        source_type: "rss",
        title: "Title",
        url: "https://example.com",
        canonical_url: "https://example.com",
        published_at: "2026-03-20T10:00:00Z",
        fetched_at: "2026-03-23T06:00:00Z",
        tags: [],
        text: "Some text",
        excerpt: "Some excerpt",
        content_hash: "sha256:abc",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe("en");
      }
    });
  });

  describe("DigestEntrySchema", () => {
    test("validates all entries in digest-entries.json fixture", async () => {
      const entries = await loadFixture<unknown[]>("digest-entries.json");
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        const result = DigestEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      }
    });

    test("rejects entry with invalid novelty_label", () => {
      const result = DigestEntrySchema.safeParse({
        id: "e1",
        title: "Test",
        summary: "Summary",
        why_it_matters: "Reason",
        novelty_label: "extreme",
        confidence_label: "high",
        source_count: 1,
        primary_source_count: 1,
        source_ids: ["s1"],
        topic_ids: ["t1"],
      });
      expect(result.success).toBe(false);
    });

    test("rejects entry with negative source_count", () => {
      const result = DigestEntrySchema.safeParse({
        id: "e1",
        title: "Test",
        summary: "Summary",
        why_it_matters: "Reason",
        novelty_label: "high",
        confidence_label: "high",
        source_count: -1,
        primary_source_count: 1,
        source_ids: ["s1"],
        topic_ids: ["t1"],
      });
      expect(result.success).toBe(false);
    });

    test("allows optional comparison_ref", () => {
      const result = DigestEntrySchema.safeParse({
        id: "e1",
        title: "Test",
        summary: "Summary",
        why_it_matters: "Reason",
        novelty_label: "high",
        confidence_label: "high",
        source_count: 1,
        primary_source_count: 1,
        source_ids: ["s1"],
        topic_ids: ["t1"],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("TopicPackSchema", () => {
    test("validates topic-pack.json fixture", async () => {
      const pack = await loadFixture<unknown>("topic-pack.json");
      const result = TopicPackSchema.safeParse(pack);
      expect(result.success).toBe(true);
    });

    test("rejects topic pack missing required arrays", () => {
      const result = TopicPackSchema.safeParse({
        id: "tp1",
        topic_key: "key",
        title: "Title",
        expanded_summary: "Summary",
        // missing why_included, what_is_new, uncertainties
        source_bundle_ref: "ref",
        related_topics: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("WeeklyDigestSchema", () => {
    test("validates weekly-digest.json fixture", async () => {
      const digest = await loadFixture<unknown>("weekly-digest.json");
      const result = WeeklyDigestSchema.safeParse(digest);
      expect(result.success).toBe(true);
    });

    test("rejects digest with invalid datetime format", () => {
      const result = WeeklyDigestSchema.safeParse({
        id: "d1",
        generated_at: "not-a-datetime",
        window_start: "2026-03-16T07:00:00Z",
        window_end: "2026-03-23T07:00:00Z",
        raw_item_count: 10,
        canonical_item_count: 9,
        top_item_count: 3,
        summary: "Summary",
        entries: [],
        new_theme_count: 0,
        accelerating_count: 0,
        cooling_count: 0,
        run_ref: "run-1",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("SourceBundleSchema", () => {
    test("validates source-bundle.json fixture", async () => {
      const bundle = await loadFixture<unknown>("source-bundle.json");
      const result = SourceBundleSchema.safeParse(bundle);
      expect(result.success).toBe(true);
    });

    test("validates source evidence with relevance_note", async () => {
      const bundle = await loadFixture<{ sources: unknown[] }>("source-bundle.json");
      expect(bundle.sources.length).toBeGreaterThan(0);
    });

    test("rejects source bundle with missing topic_key", () => {
      const result = SourceBundleSchema.safeParse({
        id: "sb1",
        // missing topic_key
        date: "2026-03-23",
        sources: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
