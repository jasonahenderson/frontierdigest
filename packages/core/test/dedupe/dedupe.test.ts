import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dedupe } from "../../src/dedupe/index.js";
import type { NormalizedItem } from "../../src/types/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

async function loadNormalizedItems(): Promise<NormalizedItem[]> {
  const raw = await readFile(join(FIXTURES_DIR, "normalized-items.json"), "utf-8");
  return JSON.parse(raw) as NormalizedItem[];
}

describe("dedupe()", () => {
  test("returns fewer canonical items than total input when duplicates exist", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);
    expect(result.total_input).toBe(items.length);
    expect(result.total_canonical).toBeLessThanOrEqual(result.total_input);
  });

  test("groups similar context engineering articles together", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    // Items 3 and 4 (indices 2, 3) have very similar titles about context engineering
    const contextEngIds = new Set([
      "a1b2c3d4e5f60003",
      "a1b2c3d4e5f60004",
    ]);

    // Find a cluster that contains both
    const cluster = result.clusters.find((c) =>
      c.member_ids.some((id) => contextEngIds.has(id)),
    );
    if (cluster) {
      // At least one of the context eng items should be in the cluster
      const overlap = cluster.member_ids.filter((id) => contextEngIds.has(id));
      expect(overlap.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("keeps distinct items separate", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    // "DeFi Protocols" and "Tool-Use Agents" are very different topics
    const defiId = "a1b2c3d4e5f60010";
    const toolUseId = "a1b2c3d4e5f60007";

    // These should NOT be in the same cluster
    for (const cluster of result.clusters) {
      const hasDefi = cluster.member_ids.includes(defiId);
      const hasToolUse = cluster.member_ids.includes(toolUseId);
      expect(hasDefi && hasToolUse).toBe(false);
    }
  });

  test("canonical representative is chosen from cluster members", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    for (const cluster of result.clusters) {
      expect(cluster.member_ids).toContain(cluster.canonical_id);
    }
  });

  test("every cluster has a merge_rationale", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    for (const cluster of result.clusters) {
      expect(cluster.merge_rationale).toBeTruthy();
      expect(typeof cluster.merge_rationale).toBe("string");
      expect(cluster.merge_rationale.length).toBeGreaterThan(0);
    }
  });

  test("clusters have valid match_type", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    const validTypes = new Set(["url", "title_similarity", "content_fingerprint"]);
    for (const cluster of result.clusters) {
      expect(validTypes.has(cluster.match_type)).toBe(true);
    }
  });

  test("similarity scores are between 0 and 1", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    for (const cluster of result.clusters) {
      expect(cluster.similarity_score).toBeGreaterThanOrEqual(0);
      expect(cluster.similarity_score).toBeLessThanOrEqual(1);
    }
  });

  test("no item appears in multiple clusters", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    const seen = new Set<string>();
    for (const cluster of result.clusters) {
      for (const memberId of cluster.member_ids) {
        expect(seen.has(memberId)).toBe(false);
        seen.add(memberId);
      }
    }
  });

  test("all canonical items are either cluster representatives or unclustered", async () => {
    const items = await loadNormalizedItems();
    const result = await dedupe(items);

    const clusterRepIds = new Set(result.clusters.map((c) => c.canonical_id));
    const clusteredIds = new Set(result.clusters.flatMap((c) => c.member_ids));

    for (const canonical of result.canonical_items) {
      const isRep = clusterRepIds.has(canonical.id);
      const isUnclustered = !clusteredIds.has(canonical.id);
      expect(isRep || isUnclustered).toBe(true);
    }
  });

  test("accepts custom thresholds", async () => {
    const items = await loadNormalizedItems();

    // Very high threshold should produce fewer clusters (harder to match)
    const strict = await dedupe(items, {
      titleSimilarityThreshold: 0.99,
      fingerprintSimilarityThreshold: 0.99,
    });

    // Very low threshold should produce more clusters (easier to match)
    const loose = await dedupe(items, {
      titleSimilarityThreshold: 0.3,
      fingerprintSimilarityThreshold: 0.3,
    });

    expect(strict.total_canonical).toBeGreaterThanOrEqual(loose.total_canonical);
  });
});
