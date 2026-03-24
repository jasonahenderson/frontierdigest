import type { DigestEntry, PromptContext, LLMConfig } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate } from "./llm.js";
import { consola } from "consola";

export interface WeeklySummaryInput {
  entries: DigestEntry[];
  windowStart: string;
  windowEnd: string;
  rawItemCount: number;
  canonicalItemCount: number;
  topItemCount: number;
}

export interface WeeklySummaryOutput {
  summary: string;
  new_theme_count: number;
  accelerating_count: number;
  cooling_count: number;
}

export async function generateWeeklySummary(
  input: WeeklySummaryInput,
  promptsDir: string,
  promptContext?: PromptContext,
  llmConfig?: LLMConfig,
): Promise<WeeklySummaryOutput> {
  consola.info("Generating weekly summary...");

  const entriesForPrompt = input.entries.map((e) => ({
    title: e.title,
    summary: e.summary,
    why_it_matters: e.why_it_matters,
    novelty_label: e.novelty_label,
    confidence_label: e.confidence_label,
    source_count: e.source_count,
  }));

  const { system, user } = await loadPrompt(
    "weekly-summary",
    {
      top_item_count: String(input.topItemCount),
      window_start: input.windowStart,
      window_end: input.windowEnd,
      raw_item_count: String(input.rawItemCount),
      canonical_item_count: String(input.canonicalItemCount),
      entries_json: JSON.stringify(entriesForPrompt, null, 2),
    },
    promptsDir,
    promptContext,
  );

  const raw = await llmGenerate(system, user, { llmConfig });
  const parsed = JSON.parse(raw) as WeeklySummaryOutput;

  // Validate required fields
  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.new_theme_count !== "number" ||
    typeof parsed.accelerating_count !== "number" ||
    typeof parsed.cooling_count !== "number"
  ) {
    throw new Error("Weekly summary response missing required fields");
  }

  consola.success("Weekly summary generated");
  return parsed;
}
