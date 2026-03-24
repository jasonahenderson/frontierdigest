import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { computeScore, scoreRelevance, scoreRecency, scoreReinforcement } from "../../src/score/index.js";
import { loadProfile, loadSources } from "../../src/config/index.js";
import type { NormalizedItem, ProfileConfig, SourceConfig } from "../../src/types/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

async function loadNormalizedItems(): Promise<NormalizedItem[]> {
  const raw = await readFile(join(FIXTURES_DIR, "normalized-items.json"), "utf-8");
  return JSON.parse(raw) as NormalizedItem[];
}

describe("scoreRelevance", () => {
  test("returns high score for item matching include interests", async () => {
    const items = await loadNormalizedItems();
    // First item is about agent memory systems -- matches "agents" and "memory systems"
    const score = scoreRelevance(items[0], ["agents", "memory systems"], []);
    expect(score).toBeGreaterThan(0.5);
  });

  test("penalizes items matching exclude interests", async () => {
    const items = await loadNormalizedItems();
    // DeFi item (last one) contains "cryptocurrency" tag
    const defiItem = items[items.length - 1];
    const withoutExclude = scoreRelevance(defiItem, ["agents"], []);
    const withExclude = scoreRelevance(defiItem, ["agents"], ["cryptocurrency"]);
    expect(withExclude).toBeLessThan(withoutExclude);
  });

  test("returns 0.5 when no include interests are defined", async () => {
    const items = await loadNormalizedItems();
    const score = scoreRelevance(items[0], [], []);
    expect(score).toBe(0.5);
  });

  test("returns 0 for item matching no include interests", async () => {
    const items = await loadNormalizedItems();
    const score = scoreRelevance(items[0], ["quantum computing", "robotics"], []);
    expect(score).toBe(0);
  });

  test("score is clamped between 0 and 1", async () => {
    const items = await loadNormalizedItems();
    for (const item of items) {
      const score = scoreRelevance(item, ["agents", "memory systems"], ["cryptocurrency"]);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("scoreRecency", () => {
  test("returns 1.0 for items published at window end", () => {
    const score = scoreRecency("2026-03-23T07:00:00Z", "2026-03-23T07:00:00Z", 7);
    expect(score).toBe(1.0);
  });

  test("returns 1.0 for items published after window end", () => {
    const score = scoreRecency("2026-03-24T00:00:00Z", "2026-03-23T07:00:00Z", 7);
    expect(score).toBe(1.0);
  });

  test("returns approximately 0.3 for items at the window start", () => {
    const score = scoreRecency("2026-03-16T07:00:00Z", "2026-03-23T07:00:00Z", 7);
    expect(score).toBeCloseTo(0.3, 1);
  });

  test("returns 0 for items older than the window", () => {
    const score = scoreRecency("2026-03-01T00:00:00Z", "2026-03-23T07:00:00Z", 7);
    expect(score).toBe(0);
  });

  test("more recent items score higher than older items", () => {
    const recent = scoreRecency("2026-03-22T00:00:00Z", "2026-03-23T07:00:00Z", 7);
    const older = scoreRecency("2026-03-18T00:00:00Z", "2026-03-23T07:00:00Z", 7);
    expect(recent).toBeGreaterThan(older);
  });

  test("score is between 0 and 1", () => {
    const score = scoreRecency("2026-03-20T00:00:00Z", "2026-03-23T07:00:00Z", 7);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("scoreReinforcement", () => {
  test("returns 0 when item has no cross-source coverage", async () => {
    const singleItem: NormalizedItem = {
      id: "unique-1",
      source_id: "only-source",
      source_name: "Only Source",
      source_type: "rss",
      title: "Quantum Teleportation Breakthrough in Photonics",
      url: "https://example.com/quantum",
      canonical_url: "https://example.com/quantum",
      published_at: "2026-03-22T10:00:00Z",
      fetched_at: "2026-03-23T06:00:00Z",
      tags: ["quantum"],
      text: "Unique quantum physics article with no overlap.",
      excerpt: "Unique quantum physics article.",
      content_hash: "sha256:unique",
      language: "en",
    };
    const score = scoreReinforcement(singleItem, [singleItem]);
    expect(score).toBe(0);
  });

  test("returns positive score for items covered by multiple sources", async () => {
    const items = await loadNormalizedItems();
    // First item is about agent memory - tags overlap with several other items
    const score = scoreReinforcement(items[0], items);
    expect(score).toBeGreaterThan(0);
  });

  test("score is capped at 1.0", async () => {
    const items = await loadNormalizedItems();
    for (const item of items) {
      const score = scoreReinforcement(item, items);
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("computeScore", () => {
  test("computes total_score using weighted formula", async () => {
    const items = await loadNormalizedItems();
    const profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
    const sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

    const result = computeScore(items[0], items, profile, sources);

    // Verify the formula:
    // total = (relevance_weight * relevance) + (source_weight * source_quality) +
    //         (recency_weight * recency) + (reinforcement_weight * reinforcement) + primary_source_bonus
    const { relevance, source_quality, recency, reinforcement, primary_source_bonus } =
      result.scores;
    const { relevance_weight, source_weight, recency_weight, reinforcement_weight } =
      profile.ranking;

    const expected =
      relevance_weight * relevance +
      source_weight * source_quality +
      recency_weight * recency +
      reinforcement_weight * reinforcement +
      primary_source_bonus;

    expect(result.total_score).toBeCloseTo(Math.round(expected * 1000) / 1000, 3);
  });

  test("items from primary sources get bonus", async () => {
    const items = await loadNormalizedItems();
    const profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
    const sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

    // test-source-1 has weight 1.0 (>= 0.8, so primary)
    const source1Item = items.find((i) => i.source_id === "test-source-1")!;
    const result = computeScore(source1Item, items, profile, sources);
    expect(result.scores.primary_source_bonus).toBe(profile.ranking.primary_source_bonus);
  });

  test("items from non-primary sources get no bonus", async () => {
    const items = await loadNormalizedItems();
    const profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
    const sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

    // test-source-3 has weight 0.6 (< 0.8, so not primary)
    const source3Item = items.find((i) => i.source_id === "test-source-3")!;
    const result = computeScore(source3Item, items, profile, sources);
    expect(result.scores.primary_source_bonus).toBe(0);
  });

  test("exclude-matched item (DeFi/crypto) scores lower than include-matched items", async () => {
    const items = await loadNormalizedItems();
    const profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
    const sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

    const agentItem = items.find((i) => i.title.includes("Memory Systems"))!;
    const defiItem = items.find((i) => i.title.includes("DeFi"))!;

    const agentScore = computeScore(agentItem, items, profile, sources);
    const defiScore = computeScore(defiItem, items, profile, sources);

    expect(agentScore.total_score).toBeGreaterThan(defiScore.total_score);
  });
});

describe("score() sorting", () => {
  test("score() returns items sorted by total_score descending", async () => {
    // Import score function
    const { score } = await import("../../src/score/index.js");
    const items = await loadNormalizedItems();
    const profile = await loadProfile(join(FIXTURES_DIR, "profile.yaml"));
    const sources = await loadSources(join(FIXTURES_DIR, "sources.yaml"));

    const scored = await score(items, profile, sources);

    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].total_score).toBeGreaterThanOrEqual(scored[i].total_score);
    }
  });
});
