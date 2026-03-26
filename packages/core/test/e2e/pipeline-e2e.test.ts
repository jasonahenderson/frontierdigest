import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  startRssServer,
  generateRssXml,
  type RssServer,
} from "../helpers/mock-rss-server.js";
import { FIXTURES_DIR } from "../helpers/fixtures.js";
import {
  WeeklyDigestSchema,
  DigestEntrySchema,
  RunManifestSchema,
} from "../../src/types/index.js";
import { z } from "zod";

// --- Load LLM fixtures and install mock ---

const LLM_FIXTURES_DIR = join(FIXTURES_DIR, "llm-responses");
const llmFixtures: Record<string, string> = {};

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

import { runWeeklyPipeline } from "../../src/pipeline/index.js";
import { FileStore } from "../../src/persist/file-store.js";
import type { ProfileConfig, SourceConfig } from "../../src/types/index.js";

let server: RssServer;
let tempDir: string;
let today: string;

describe("E2E: Full pipeline from RSS to persisted artifacts", () => {
  beforeAll(async () => {
    for (const name of ["digest-entry", "topic-expand", "weekly-summary", "compare", "topic-sources"]) {
      llmFixtures[name] = await readFile(join(LLM_FIXTURES_DIR, `${name}.json`), "utf-8");
    }

    today = new Date().toISOString().slice(0, 10);
    const [y, m, d] = today.split("-");

    // Create 3 feeds with overlapping content to test dedupe
    const feed1 = generateRssXml([
      {
        title: "Agent Memory Systems: A New Approach",
        link: "https://example.com/agent-memory",
        pubDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toUTCString(),
        description: "Hierarchical memory architectures for AI agents with tiered retrieval.",
      },
      {
        title: "Context Engineering Best Practices",
        link: "https://example.com/context-eng",
        pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toUTCString(),
        description: "Production-grade context window engineering for LLM applications.",
      },
    ], "AI Research Feed");

    const feed2 = generateRssXml([
      {
        title: "Multi-Agent Coordination Benchmarks",
        link: "https://example.com/multi-agent",
        pubDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toUTCString(),
        description: "New benchmarks for evaluating multi-agent task decomposition.",
      },
    ], "ML News Feed");

    const feed3 = generateRssXml([
      {
        title: "Agent Memory Systems: A New Approach",
        link: "https://example.com/agent-memory",
        pubDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toUTCString(),
        description: "Duplicate of the agent memory paper from another source.",
      },
    ], "Tech Blog");

    server = await startRssServer({
      feeds: {
        "/feed1.xml": feed1,
        "/feed2.xml": feed2,
        "/feed3.xml": feed3,
      },
    });

    tempDir = await mkdtemp(join(tmpdir(), "fd-e2e-pipeline-"));
  });

  afterAll(async () => {
    mock.restore();
    server?.stop();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  test("RSS -> pipeline -> artifacts on disk", async () => {
    const profile: ProfileConfig = {
      profile: "e2e-test",
      window: { weekly_lookback_days: 30 },
      interests: {
        include: ["agents", "memory", "context-engineering", "multi-agent"],
        exclude: [],
      },
      ranking: {
        max_digest_items: 5,
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
        id: "feed-1",
        type: "rss",
        name: "AI Research Feed",
        url: `${server.url}/feed1.xml`,
        weight: 1.0,
        tags: ["agents", "memory", "context"],
      },
      {
        id: "feed-2",
        type: "rss",
        name: "ML News Feed",
        url: `${server.url}/feed2.xml`,
        weight: 0.8,
        tags: ["multi-agent"],
      },
      {
        id: "feed-3",
        type: "rss",
        name: "Tech Blog",
        url: `${server.url}/feed3.xml`,
        weight: 0.6,
        tags: ["agents"],
      },
    ];

    const store = new FileStore(tempDir);
    const manifest = await runWeeklyPipeline(profile, sources, store);

    // --- Verify manifest ---
    expect(manifest.status).toBe("completed");
    expect(manifest.steps.length).toBe(8);
    for (const step of manifest.steps) {
      expect(step.status).toBe("completed");
    }

    // Verify ingestion found items (4 total: 2 + 1 + 1 duplicate)
    const ingestStep = manifest.steps.find((s) => s.name === "ingest");
    expect(ingestStep!.item_count).toBe(4);

    // Dedupe should reduce count (duplicate URL)
    const dedupeStep = manifest.steps.find((s) => s.name === "dedupe");
    expect(dedupeStep!.item_count!).toBeLessThan(4);

    // --- Verify artifacts on disk ---
    const [y, m, d] = today.split("-");

    // Check digest file exists and validates
    const digestPath = join(tempDir, "digests", y, m, d, "weekly.json");
    const digestRaw = await readFile(digestPath, "utf-8");
    const digestParsed = WeeklyDigestSchema.safeParse(JSON.parse(digestRaw));
    expect(digestParsed.success).toBe(true);

    // Check entries file exists and validates
    const entriesPath = join(tempDir, "digests", y, m, d, "entries.json");
    const entriesRaw = await readFile(entriesPath, "utf-8");
    const entriesParsed = z.array(DigestEntrySchema).safeParse(JSON.parse(entriesRaw));
    expect(entriesParsed.success).toBe(true);
    expect(entriesParsed.data!.length).toBeGreaterThan(0);

    // Check runs directory has manifest
    const runsDir = join(tempDir, "runs");
    const runsStat = await stat(runsDir);
    expect(runsStat.isDirectory()).toBe(true);

    // Check digest entry count respects max_digest_items
    expect(entriesParsed.data!.length).toBeLessThanOrEqual(
      profile.ranking.max_digest_items,
    );
  }, { timeout: 30_000 });
});
