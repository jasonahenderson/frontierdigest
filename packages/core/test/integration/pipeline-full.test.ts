import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  startRssServer,
  generateRssXml,
  type RssServer,
} from "../helpers/mock-rss-server.js";
import { FIXTURES_DIR } from "../helpers/fixtures.js";

// --- Load LLM fixtures and install mock BEFORE importing pipeline ---

const LLM_FIXTURES_DIR = join(FIXTURES_DIR, "llm-responses");
const llmFixtures: Record<string, string> = {};

async function loadLlmFixture(name: string): Promise<string> {
  return readFile(join(LLM_FIXTURES_DIR, `${name}.json`), "utf-8");
}

function routeResponse(system: string, user: string): string {
  const sys = system.toLowerCase();
  if (sys.includes("track how topics evolve over time"))
    return llmFixtures["compare"];
  if (sys.includes("in-depth topic analysis"))
    return llmFixtures["topic-expand"];
  if (sys.includes("catalog and classify sources"))
    return llmFixtures["topic-sources"];
  if (sys.includes("weekly digest summaries"))
    return llmFixtures["weekly-summary"];
  return llmFixtures["digest-entry"];
}

mock.module("../../src/synthesize/llm.js", () => {
  const original = require("../../src/synthesize/llm.js");
  return {
    llmGenerate: async (system: string, user: string) => routeResponse(system, user),
    extractJson: original.extractJson,
    resolveConfig: original.resolveConfig,
    createModel: original.createModel,
  };
});

// NOW import pipeline (after mock is installed)
import { runWeeklyPipeline } from "../../src/pipeline/index.js";
import { FileStore } from "../../src/persist/file-store.js";
import type { ProfileConfig, SourceConfig, RunManifest } from "../../src/types/index.js";

let server: RssServer;
let tempDir: string;

describe("Full pipeline integration (mocked LLM + local RSS)", () => {
  beforeAll(async () => {
    // Load LLM fixtures
    for (const name of ["digest-entry", "topic-expand", "weekly-summary", "compare", "topic-sources"]) {
      llmFixtures[name] = await loadLlmFixture(name);
    }

    // Create RSS feeds
    const feed1 = generateRssXml([
      {
        title: "Agent Memory Systems Paper",
        link: "https://example.com/paper-1",
        pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toUTCString(),
        description: "A new approach to agent memory using hierarchical storage layers for long-horizon tasks.",
      },
      {
        title: "Context Engineering for Production LLM Apps",
        link: "https://example.com/paper-2",
        pubDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toUTCString(),
        description: "Best practices for engineering context windows in production LLM applications.",
      },
    ], "Test Feed One");

    const feed2 = generateRssXml([
      {
        title: "Evaluating Multi-Agent Coordination",
        link: "https://example.com/paper-3",
        pubDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toUTCString(),
        description: "A comprehensive evaluation framework for multi-agent systems and coordination benchmarks.",
      },
    ], "Test Feed Two");

    server = await startRssServer({
      feeds: { "/feed1.xml": feed1, "/feed2.xml": feed2 },
    });

    tempDir = await mkdtemp(join(tmpdir(), "fd-pipeline-full-"));
  });

  afterAll(async () => {
    mock.restore();
    server?.stop();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  test("full pipeline completes with all 8 steps", async () => {
    const profile: ProfileConfig = {
      profile: "integration-test",
      window: { weekly_lookback_days: 30 },
      interests: {
        include: ["agents", "memory", "context-engineering", "multi-agent"],
        exclude: [],
      },
      ranking: {
        max_digest_items: 3,
        primary_source_bonus: 0.2,
        recency_weight: 0.2,
        relevance_weight: 0.4,
        source_weight: 0.2,
        reinforcement_weight: 0.2,
      },
      outputs: {
        root_dir: tempDir,
        write_markdown: false,
        write_json: true,
      },
    };

    const sources: SourceConfig[] = [
      {
        id: "test-feed-1",
        type: "rss",
        name: "Test Feed One",
        url: `${server.url}/feed1.xml`,
        weight: 1.0,
        tags: ["agents", "memory"],
      },
      {
        id: "test-feed-2",
        type: "rss",
        name: "Test Feed Two",
        url: `${server.url}/feed2.xml`,
        weight: 0.8,
        tags: ["multi-agent"],
      },
    ];

    const store = new FileStore(tempDir);
    const manifest = await runWeeklyPipeline(profile, sources, store);

    // All 8 steps should be present
    expect(manifest.steps.length).toBe(8);

    // Verify step names in order
    const stepNames = manifest.steps.map((s) => s.name);
    expect(stepNames).toEqual([
      "ingest",
      "normalize",
      "dedupe",
      "score",
      "cluster",
      "synthesize",
      "persist",
      "save_manifest",
    ]);

    // All steps should be completed
    for (const step of manifest.steps) {
      expect(step.status).toBe("completed");
    }

    // Ingest should find 3 items
    const ingestStep = manifest.steps.find((s) => s.name === "ingest");
    expect(ingestStep!.item_count).toBe(3);

    // Pipeline status should be completed
    expect(manifest.status).toBe("completed");
  }, { timeout: 30_000 });

  test("pipeline with empty feeds still completes gracefully", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "fd-pipeline-empty-"));

    const profile: ProfileConfig = {
      profile: "empty-test",
      window: { weekly_lookback_days: 30 },
      interests: { include: [], exclude: [] },
      ranking: {
        max_digest_items: 3,
        primary_source_bonus: 0.2,
        recency_weight: 0.25,
        relevance_weight: 0.25,
        source_weight: 0.25,
        reinforcement_weight: 0.25,
      },
      outputs: { root_dir: emptyDir, write_markdown: false, write_json: true },
    };

    // Point at non-existent feed paths
    const sources: SourceConfig[] = [
      {
        id: "empty-1",
        type: "rss",
        name: "Empty Source",
        url: `${server.url}/nonexistent.xml`,
        weight: 1.0,
        tags: [],
      },
    ];

    const store = new FileStore(emptyDir);
    const manifest = await runWeeklyPipeline(profile, sources, store);

    // Pipeline should complete (though some steps may have 0 items)
    expect(manifest.steps.length).toBe(8);

    // Ingest should report 0 items (feed not found -> returns [])
    const ingestStep = manifest.steps.find((s) => s.name === "ingest");
    expect(ingestStep!.item_count).toBe(0);

    await rm(emptyDir, { recursive: true, force: true });
  }, { timeout: 15_000 });

  test("pipeline with one failing source still processes others", async () => {
    const partialDir = await mkdtemp(join(tmpdir(), "fd-pipeline-partial-"));

    const profile: ProfileConfig = {
      profile: "partial-test",
      window: { weekly_lookback_days: 30 },
      interests: { include: ["agents"], exclude: [] },
      ranking: {
        max_digest_items: 3,
        primary_source_bonus: 0.2,
        recency_weight: 0.25,
        relevance_weight: 0.25,
        source_weight: 0.25,
        reinforcement_weight: 0.25,
      },
      outputs: { root_dir: partialDir, write_markdown: false, write_json: true },
    };

    const sources: SourceConfig[] = [
      {
        id: "good-feed",
        type: "rss",
        name: "Good Feed",
        url: `${server.url}/feed1.xml`,
        weight: 1.0,
        tags: ["agents"],
      },
      {
        id: "bad-feed",
        type: "rss",
        name: "Bad Feed",
        url: `${server.url}/404-feed.xml`,
        weight: 1.0,
        tags: [],
      },
    ];

    const store = new FileStore(partialDir);
    const manifest = await runWeeklyPipeline(profile, sources, store);

    // Should still get items from good feed
    const ingestStep = manifest.steps.find((s) => s.name === "ingest");
    expect(ingestStep!.item_count!).toBeGreaterThan(0);

    await rm(partialDir, { recursive: true, force: true });
  }, { timeout: 30_000 });
});
