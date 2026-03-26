import { mock } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LLM_FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "llm-responses");

async function loadLlmFixture(name: string): Promise<string> {
  const raw = await readFile(join(LLM_FIXTURES_DIR, `${name}.json`), "utf-8");
  return raw;
}

// Pre-load all fixtures at module init time
let fixturesLoaded = false;
let DIGEST_ENTRY = "";
let TOPIC_EXPAND = "";
let WEEKLY_SUMMARY = "";
let COMPARE = "";
let TOPIC_SOURCES = "";

async function ensureFixtures() {
  if (fixturesLoaded) return;
  DIGEST_ENTRY = await loadLlmFixture("digest-entry");
  TOPIC_EXPAND = await loadLlmFixture("topic-expand");
  WEEKLY_SUMMARY = await loadLlmFixture("weekly-summary");
  COMPARE = await loadLlmFixture("compare");
  TOPIC_SOURCES = await loadLlmFixture("topic-sources");
  fixturesLoaded = true;
}

export const MOCK_LLM_RESPONSES = {
  get digestEntry() { return DIGEST_ENTRY; },
  get topicExpand() { return TOPIC_EXPAND; },
  get weeklySummary() { return WEEKLY_SUMMARY; },
  get compare() { return COMPARE; },
  get topicSources() { return TOPIC_SOURCES; },
};

/**
 * Route a mock LLM response based on system prompt keywords.
 * Uses system prompt only (stable, not affected by untrusted data in user prompt).
 */
function routeResponse(systemPrompt: string, _userPrompt: string): string {
  const sys = systemPrompt.toLowerCase();

  if (sys.includes("track how topics evolve over time")) {
    return COMPARE;
  }
  if (sys.includes("in-depth topic analysis")) {
    return TOPIC_EXPAND;
  }
  if (sys.includes("catalog and classify sources")) {
    return TOPIC_SOURCES;
  }
  if (sys.includes("weekly digest summaries")) {
    return WEEKLY_SUMMARY;
  }
  // Default to digest entry
  return DIGEST_ENTRY;
}

export interface LlmMockOverrides {
  /** Override the response for all calls */
  fixedResponse?: string;
  /** Override routing for specific templates */
  responses?: Partial<Record<string, string>>;
  /** Throw an error instead of returning */
  shouldThrow?: Error;
}

/**
 * Create a mock for llmGenerate that returns fixture-based responses.
 * Must be called after ensureFixtures().
 */
export function createLlmMock(overrides?: LlmMockOverrides) {
  const calls: Array<{ system: string; user: string; options?: unknown }> = [];

  const mockFn = mock(
    async (
      systemPrompt: string,
      userPrompt: string,
      options?: unknown,
    ): Promise<string> => {
      calls.push({ system: systemPrompt, user: userPrompt, options });

      if (overrides?.shouldThrow) {
        throw overrides.shouldThrow;
      }

      if (overrides?.fixedResponse) {
        return overrides.fixedResponse;
      }

      return routeResponse(systemPrompt, userPrompt);
    },
  );

  return {
    mockFn,
    calls,
    /** Reset call history */
    reset() {
      calls.length = 0;
      mockFn.mockClear();
    },
  };
}

/**
 * Install the LLM mock by intercepting the module.
 * Returns the mock handle for assertions.
 * Must be called before importing any synthesis modules.
 */
export async function installLlmMock(overrides?: LlmMockOverrides) {
  await ensureFixtures();

  const llmMock = createLlmMock(overrides);

  // Use Bun's module mocking to intercept llm.ts imports
  mock.module("../../src/synthesize/llm.js", () => ({
    llmGenerate: llmMock.mockFn,
    extractJson: (await import("../../src/synthesize/llm.js")).extractJson,
    resolveConfig: (await import("../../src/synthesize/llm.js")).resolveConfig,
    createModel: mock(() => ({})),
  }));

  return llmMock;
}

export { ensureFixtures };
