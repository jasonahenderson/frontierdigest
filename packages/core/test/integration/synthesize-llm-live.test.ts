import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import { generateDigestEntry } from "../../src/synthesize/digest-entry.js";
import { generateWeeklySummary } from "../../src/synthesize/weekly-summary.js";
import { extractJson } from "../../src/synthesize/llm.js";
import type { TopicCluster, DigestEntry } from "../../src/types/index.js";

const PROMPTS_DIR = resolve(import.meta.dir, "../../../../prompts");

// Gate all tests behind FD_TEST_LLM env var
const SKIP = !process.env.FD_TEST_LLM;

function makeTestCluster(): TopicCluster {
  return {
    id: "cluster-live-1",
    label: "agent-memory",
    tags: ["agents", "memory"],
    aggregate_score: 0.85,
    primary_source_count: 1,
    item_ids: ["item-1"],
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
          author: "",
          tags: ["agents", "memory"],
          text: "A new approach to agent memory that uses hierarchical storage layers to maintain context across long-horizon tasks.",
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

describe.skipIf(SKIP)("Synthesize live LLM integration", () => {
  test(
    "generateDigestEntry returns valid JSON from real LLM",
    async () => {
      const cluster = makeTestCluster();

      const result = await generateDigestEntry(
        cluster,
        ["agents", "memory-systems"],
        "test-profile",
        PROMPTS_DIR,
      );

      expect(result.title).toBeTypeOf("string");
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.summary).toBeTypeOf("string");
      expect(result.summary.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(result.novelty_label);
      expect(["high", "medium", "low"]).toContain(result.confidence_label);
    },
    { timeout: 60_000 },
  );

  test(
    "generateWeeklySummary returns valid JSON from real LLM",
    async () => {
      const entry: DigestEntry = {
        id: "entry-live-1",
        title: "Agent Memory Systems Advance",
        summary: "Teams converge on hierarchical memory architectures for agents.",
        why_it_matters: "Key bottleneck for production agent deployment.",
        novelty_label: "high",
        confidence_label: "high",
        source_count: 1,
        primary_source_count: 1,
        source_ids: ["item-1"],
        topic_ids: ["cluster-live-1"],
      };

      const result = await generateWeeklySummary(
        {
          entries: [entry],
          windowStart: "2026-03-16T00:00:00Z",
          windowEnd: "2026-03-23T00:00:00Z",
          rawItemCount: 5,
          canonicalItemCount: 4,
          topItemCount: 1,
        },
        PROMPTS_DIR,
      );

      expect(result.summary).toBeTypeOf("string");
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.new_theme_count).toBeTypeOf("number");
    },
    { timeout: 60_000 },
  );

  test("extractJson handles real-world LLM response with markdown fences", () => {
    const fenced = '```json\n{"title": "Test", "summary": "Hello"}\n```';
    const result = extractJson(fenced) as { title: string };
    expect(result.title).toBe("Test");
  });

  test("extractJson handles response with preamble text", () => {
    const withPreamble = 'Here is the result:\n\n{"title": "Test", "value": 42}';
    const result = extractJson(withPreamble) as { title: string; value: number };
    expect(result.title).toBe("Test");
    expect(result.value).toBe(42);
  });
});
