import { z } from "zod";
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

const WeeklySummaryOutputSchema = z.object({
  summary: z.string(),
  new_theme_count: z.number(),
  accelerating_count: z.number(),
  cooling_count: z.number(),
});

export type WeeklySummaryOutput = z.infer<typeof WeeklySummaryOutputSchema>;

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

  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();

  let jsonParsed: unknown;
  try {
    jsonParsed = JSON.parse(cleaned);
  } catch {
    consola.error("LLM returned non-JSON for weekly summary");
    throw new Error("Failed to parse LLM response as JSON for weekly summary");
  }

  const result = WeeklySummaryOutputSchema.safeParse(jsonParsed);
  if (!result.success) {
    consola.error(`LLM output validation failed: ${result.error.message}`);
    throw new Error("Invalid LLM output for weekly summary");
  }

  consola.success("Weekly summary generated");
  return result.data;
}
