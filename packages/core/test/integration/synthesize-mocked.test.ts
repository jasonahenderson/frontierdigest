import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadFixture, FIXTURES_DIR } from "../helpers/fixtures.js";

// --- Mock llmGenerate before importing synthesis modules ---

const LLM_FIXTURES_DIR = join(FIXTURES_DIR, "llm-responses");
const llmFixtures: Record<string, string> = {};

const capturedCalls: Array<{ system: string; user: string }> = [];

// Load all LLM response fixtures
async function loadLlmFixtures() {
  for (const name of [
    "digest-entry",
    "topic-expand",
    "weekly-summary",
    "compare",
    "topic-sources",
  ]) {
    llmFixtures[name] = await readFile(
      join(LLM_FIXTURES_DIR, `${name}.json`),
      "utf-8",
    );
  }
}

function routeResponse(system: string, user: string): string {
  // Route based on system prompt keywords (stable, not affected by untrusted data)
  const sys = system.toLowerCase();
  if (sys.includes("track how topics evolve over time"))
    return llmFixtures["compare"];
  if (sys.includes("in-depth topic analysis"))
    return llmFixtures["topic-expand"];
  if (sys.includes("catalog and classify sources"))
    return llmFixtures["topic-sources"];
  if (sys.includes("weekly digest summaries"))
    return llmFixtures["weekly-summary"];
  // Default: digest entry
  return llmFixtures["digest-entry"];
}

// Install module mock
mock.module("../../src/synthesize/llm.js", () => {
  const original = require("../../src/synthesize/llm.js");
  return {
    llmGenerate: async (system: string, user: string, _opts?: unknown) => {
      capturedCalls.push({ system, user });
      return routeResponse(system, user);
    },
    extractJson: original.extractJson,
    resolveConfig: original.resolveConfig,
    createModel: () => ({}),
  };
});

// NOW import synthesis modules (after mock is installed)
import { generateDigestEntry } from "../../src/synthesize/digest-entry.js";
import { generateTopicExpansion } from "../../src/synthesize/topic-expand.js";
import { generateSourceBundle } from "../../src/synthesize/topic-sources.js";
import { generateComparison } from "../../src/synthesize/compare.js";
import { generateWeeklySummary } from "../../src/synthesize/weekly-summary.js";
import { loadPrompt } from "../../src/synthesize/prompt-loader.js";
import type { TopicCluster, DigestEntry, TopicPack } from "../../src/types/index.js";

const PROMPTS_DIR = resolve(import.meta.dir, "../../../../prompts");

// Minimal test cluster
function makeTestCluster(): TopicCluster {
  return {
    id: "cluster-test-1",
    label: "test-topic",
    tags: ["agents", "memory"],
    aggregate_score: 0.85,
    primary_source_count: 1,
    item_ids: ["item-1", "item-2"],
    items: [
      {
        item: {
          id: "item-1",
          source_id: "src-1",
          source_name: "Test Source",
          source_type: "rss",
          title: "Agent Memory Systems Paper",
          url: "https://example.com/paper-1",
          canonical_url: "https://example.com/paper-1",
          published_at: "2026-03-18T10:00:00Z",
          fetched_at: "2026-03-18T12:00:00Z",
          author: "Test Author",
          tags: ["agents", "memory"],
          text: "A new approach to agent memory using hierarchical storage layers.",
          excerpt: "A new approach to agent memory using hierarchical storage layers.",
          content_hash: "abc123",
          language: "en",
        },
        total_score: 0.9,
        breakdown: {
          relevance: 0.8,
          recency: 0.7,
          source_weight: 1.0,
          reinforcement: 0.5,
        },
      },
    ],
  };
}

function makeTestEntry(): DigestEntry {
  return {
    id: "entry-test-1",
    title: "Agent Memory Systems Advance",
    summary: "Multiple teams converge on hierarchical memory architectures.",
    why_it_matters: "Key bottleneck for agent deployment.",
    novelty_label: "high",
    confidence_label: "high",
    source_count: 2,
    primary_source_count: 1,
    source_ids: ["item-1", "item-2"],
    topic_ids: ["cluster-test-1"],
  };
}

describe("Synthesize integration (mocked LLM)", () => {
  beforeAll(async () => {
    await loadLlmFixtures();
    capturedCalls.length = 0;
  });

  afterAll(() => {
    mock.restore();
  });

  describe("generateDigestEntry", () => {
    test("loads correct prompt and validates output", async () => {
      const cluster = makeTestCluster();
      capturedCalls.length = 0;

      const result = await generateDigestEntry(
        cluster,
        ["agents", "memory-systems"],
        "test-profile",
        PROMPTS_DIR,
      );

      expect(result.title).toBeTypeOf("string");
      expect(result.summary).toBeTypeOf("string");
      expect(result.why_it_matters).toBeTypeOf("string");
      expect(["high", "medium", "low"]).toContain(result.novelty_label);
      expect(["high", "medium", "low"]).toContain(result.confidence_label);
    });

    test("passes prompt context persona/focus to system prompt", async () => {
      const cluster = makeTestCluster();
      capturedCalls.length = 0;

      await generateDigestEntry(
        cluster,
        ["agents"],
        "test-profile",
        PROMPTS_DIR,
        { persona: "You are a quantum physicist.", focus: "quantum computing" },
      );

      expect(capturedCalls.length).toBeGreaterThan(0);
      const lastCall = capturedCalls[capturedCalls.length - 1];
      expect(lastCall.system).toContain("quantum physicist");
    });
  });

  describe("generateTopicExpansion", () => {
    test("loads prompt and validates output", async () => {
      const result = await generateTopicExpansion(
        makeTestEntry(),
        makeTestCluster(),
        ["agents"],
        PROMPTS_DIR,
      );

      expect(result.expanded_summary).toBeTypeOf("string");
      expect(Array.isArray(result.why_included)).toBe(true);
      expect(Array.isArray(result.what_is_new)).toBe(true);
      expect(Array.isArray(result.uncertainties)).toBe(true);
      expect(Array.isArray(result.related_topics)).toBe(true);
    });
  });

  describe("generateSourceBundle", () => {
    test("produces valid source evidence", async () => {
      const result = await generateSourceBundle(
        makeTestCluster(),
        "Test Entry Title",
        PROMPTS_DIR,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      for (const source of result) {
        expect(source.item_id).toBeTypeOf("string");
        expect(source.title).toBeTypeOf("string");
        expect(source.url).toBeTypeOf("string");
        expect(source.source_name).toBeTypeOf("string");
        expect(typeof source.is_primary).toBe("boolean");
      }
    });
  });

  describe("generateComparison", () => {
    test("handles null previous topic pack", async () => {
      const result = await generateComparison(
        makeTestEntry(),
        makeTestCluster(),
        null, // no previous topic
        PROMPTS_DIR,
      );

      expect(result.previous_framing).toBeTypeOf("string");
      expect(result.current_framing).toBeTypeOf("string");
      expect(Array.isArray(result.detected_shifts)).toBe(true);
      expect(result.trend_interpretation).toBeTypeOf("string");
    });

    test("works with previous topic pack", async () => {
      const previousTopic = await loadFixture<TopicPack>("topic-pack.json");
      capturedCalls.length = 0;

      const result = await generateComparison(
        makeTestEntry(),
        makeTestCluster(),
        previousTopic,
        PROMPTS_DIR,
      );

      expect(result.current_framing).toBeTypeOf("string");
    });
  });

  describe("generateWeeklySummary", () => {
    test("loads prompt and validates output", async () => {
      const result = await generateWeeklySummary(
        {
          entries: [makeTestEntry()],
          windowStart: "2026-03-16T00:00:00Z",
          windowEnd: "2026-03-23T00:00:00Z",
          rawItemCount: 10,
          canonicalItemCount: 8,
          topItemCount: 3,
        },
        PROMPTS_DIR,
      );

      expect(result.summary).toBeTypeOf("string");
      expect(result.new_theme_count).toBeTypeOf("number");
      expect(result.accelerating_count).toBeTypeOf("number");
      expect(result.cooling_count).toBeTypeOf("number");
    });
  });

  describe("prompt loading", () => {
    test("untrusted content is wrapped with boundary markers", async () => {
      capturedCalls.length = 0;

      await generateDigestEntry(
        makeTestCluster(),
        ["agents"],
        "test-profile",
        PROMPTS_DIR,
      );

      const lastCall = capturedCalls[capturedCalls.length - 1];
      // Untrusted vars in user prompt should be wrapped with source_data tags
      expect(lastCall.user).toContain("<source_data");
    });
  });
});
