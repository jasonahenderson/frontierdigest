import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalize } from "../../src/normalize/index.js";
import type { RawItem } from "../../src/normalize/index.js";
import { dedupe } from "../../src/dedupe/index.js";
import { score } from "../../src/score/index.js";
import { loadProfile, loadSources } from "../../src/config/index.js";
import { NormalizedItemSchema } from "../../src/types/index.js";
import type { NormalizedItem, ProfileConfig, SourceConfig } from "../../src/types/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

describe("Pipeline integration (no LLM)", () => {
  let rawItems: RawItem[];
  let profile: ProfileConfig;
  let sources: SourceConfig[];

  // Load fixtures once before all tests
  test("loads fixture data", async () => {
    rawItems = await loadFixture<RawItem[]>("raw-items.json");
    profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
    sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

    expect(rawItems).toHaveLength(10);
    expect(profile.profile).toBe("test-profile");
    expect(sources).toHaveLength(3);
  });

  describe("normalize step", () => {
    let normalizedItems: NormalizedItem[];

    test("normalizes all raw items", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      normalizedItems = await normalize(rawItems);
      expect(normalizedItems).toHaveLength(rawItems.length);
    });

    test("all normalized items validate against schema", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      normalizedItems = await normalize(rawItems);
      for (const item of normalizedItems) {
        expect(NormalizedItemSchema.safeParse(item).success).toBe(true);
      }
    });
  });

  describe("normalize -> dedupe step", () => {
    test("dedupe reduces or maintains item count", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      const normalizedItems = await normalize(rawItems);
      const dedupeResult = await dedupe(normalizedItems);

      expect(dedupeResult.total_input).toBe(normalizedItems.length);
      expect(dedupeResult.total_canonical).toBeLessThanOrEqual(dedupeResult.total_input);
      expect(dedupeResult.canonical_items.length).toBe(dedupeResult.total_canonical);
    });

    test("all canonical items are valid NormalizedItems", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      const normalizedItems = await normalize(rawItems);
      const dedupeResult = await dedupe(normalizedItems);

      for (const item of dedupeResult.canonical_items) {
        expect(NormalizedItemSchema.safeParse(item).success).toBe(true);
      }
    });
  });

  describe("normalize -> dedupe -> score step", () => {
    test("scores all canonical items and sorts descending", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
      sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

      const normalizedItems = await normalize(rawItems);
      const dedupeResult = await dedupe(normalizedItems);
      const scoredItems = await score(dedupeResult.canonical_items, profile, sources);

      expect(scoredItems).toHaveLength(dedupeResult.canonical_items.length);

      // Verify descending sort
      for (let i = 1; i < scoredItems.length; i++) {
        expect(scoredItems[i - 1].total_score).toBeGreaterThanOrEqual(
          scoredItems[i].total_score,
        );
      }
    });

    test("every scored item has score breakdown fields", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
      sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

      const normalizedItems = await normalize(rawItems);
      const dedupeResult = await dedupe(normalizedItems);
      const scoredItems = await score(dedupeResult.canonical_items, profile, sources);

      for (const scored of scoredItems) {
        expect(scored.scores).toBeDefined();
        expect(typeof scored.scores.relevance).toBe("number");
        expect(typeof scored.scores.source_quality).toBe("number");
        expect(typeof scored.scores.recency).toBe("number");
        expect(typeof scored.scores.reinforcement).toBe("number");
        expect(typeof scored.scores.primary_source_bonus).toBe("number");
        expect(typeof scored.total_score).toBe("number");
      }
    });

    test("excluded interest (cryptocurrency) items rank lower", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
      sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

      const normalizedItems = await normalize(rawItems);
      const dedupeResult = await dedupe(normalizedItems);
      const scoredItems = await score(dedupeResult.canonical_items, profile, sources);

      // The DeFi/crypto item should not be in the top 3
      const top3 = scoredItems.slice(0, Math.min(3, scoredItems.length));
      for (const item of top3) {
        expect(item.item.title).not.toContain("DeFi");
      }
    });

    test("top items respect max_digest_items setting", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
      sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

      const normalizedItems = await normalize(rawItems);
      const dedupeResult = await dedupe(normalizedItems);
      const scoredItems = await score(dedupeResult.canonical_items, profile, sources);

      const topItems = scoredItems.slice(0, profile.ranking.max_digest_items);
      expect(topItems.length).toBeLessThanOrEqual(profile.ranking.max_digest_items);
    });
  });

  describe("full pipeline data flow", () => {
    test("end-to-end: raw items -> normalize -> dedupe -> score produces valid output", async () => {
      rawItems = await loadFixture<RawItem[]>("raw-items.json");
      profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
      sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

      // Step 1: Normalize
      const normalizedItems = await normalize(rawItems);
      expect(normalizedItems.length).toBeGreaterThan(0);

      // Step 2: Dedupe
      const dedupeResult = await dedupe(normalizedItems);
      expect(dedupeResult.canonical_items.length).toBeGreaterThan(0);
      expect(dedupeResult.total_canonical).toBeLessThanOrEqual(dedupeResult.total_input);

      // Step 3: Score
      const scoredItems = await score(dedupeResult.canonical_items, profile, sources);
      expect(scoredItems.length).toBe(dedupeResult.canonical_items.length);

      // Step 4: Select top items
      const topItems = scoredItems.slice(0, profile.ranking.max_digest_items);
      expect(topItems.length).toBeGreaterThan(0);
      expect(topItems.length).toBeLessThanOrEqual(profile.ranking.max_digest_items);

      // Verify the whole chain maintained data integrity
      for (const scored of topItems) {
        expect(scored.item.id).toBeTruthy();
        expect(scored.item.title).toBeTruthy();
        expect(scored.item.canonical_url).toBeTruthy();
        expect(scored.total_score).toBeGreaterThan(0);
      }
    });
  });
});
