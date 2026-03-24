import { z } from "zod";
import type { DigestEntry, TopicCluster, TopicPack, PromptContext, LLMConfig } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate } from "./llm.js";
import { consola } from "consola";

const ComparisonOutputSchema = z.object({
  previous_framing: z.string(),
  current_framing: z.string(),
  detected_shifts: z.array(z.string()),
  trend_interpretation: z.string(),
});

export type ComparisonOutput = z.infer<typeof ComparisonOutputSchema>;

export async function generateComparison(
  currentEntry: DigestEntry,
  currentCluster: TopicCluster,
  previousTopic: TopicPack | null,
  promptsDir: string,
  promptContext?: PromptContext,
  llmConfig?: LLMConfig,
): Promise<ComparisonOutput> {
  consola.info(`Generating comparison for: ${currentEntry.title}`);

  const { system, user } = await loadPrompt(
    "compare-last-week",
    {
      current_entry_json: JSON.stringify(currentEntry, null, 2),
      current_cluster_json: JSON.stringify(currentCluster, null, 2),
      previous_topic_json:
        previousTopic !== null
          ? JSON.stringify(previousTopic, null, 2)
          : "null",
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
    consola.error(`LLM returned non-JSON for comparison: ${currentEntry.title}`);
    throw new Error(`Failed to parse LLM response as JSON for comparison: ${currentEntry.title}`);
  }

  const result = ComparisonOutputSchema.safeParse(jsonParsed);
  if (!result.success) {
    consola.error(`LLM output validation failed: ${result.error.message}`);
    throw new Error(`Invalid LLM output for comparison: ${currentEntry.title}`);
  }

  consola.success(`Comparison generated for: ${currentEntry.title}`);
  return result.data;
}
