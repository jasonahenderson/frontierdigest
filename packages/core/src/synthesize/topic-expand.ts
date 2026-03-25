import { z } from "zod";
import type { DigestEntry, TopicCluster, PromptContext, LLMConfig } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate, extractJson } from "./llm.js";
import { consola } from "consola";

const TopicExpandOutputSchema = z.object({
  expanded_summary: z.string(),
  why_included: z.array(z.string()),
  what_is_new: z.array(z.string()),
  uncertainties: z.array(z.string()),
  related_topics: z.array(z.string()),
});

export type TopicExpandOutput = z.infer<typeof TopicExpandOutputSchema>;

export async function generateTopicExpansion(
  entry: DigestEntry,
  cluster: TopicCluster,
  interestList: string[],
  promptsDir: string,
  promptContext?: PromptContext,
  llmConfig?: LLMConfig,
): Promise<TopicExpandOutput> {
  consola.info(`Generating topic expansion for: ${entry.title}`);

  const trimmedCluster = {
    label: cluster.label,
    tags: cluster.tags,
    items: cluster.items.slice(0, 5).map(si => ({
      title: si.item.title,
      source_name: si.item.source_name,
      excerpt: si.item.excerpt,
      tags: si.item.tags,
    })),
  };

  const { system, user } = await loadPrompt(
    "topic-expand",
    {
      interest_list: interestList.join(", "),
      entry_json: JSON.stringify(entry, null, 2),
      cluster_json: JSON.stringify(trimmedCluster, null, 2),
    },
    promptsDir,
    promptContext,
  );

  const raw = await llmGenerate(system, user, { llmConfig });

  let jsonParsed: unknown;
  try {
    jsonParsed = extractJson(raw);
  } catch {
    consola.error(`LLM returned non-JSON for topic expansion: ${entry.title}: ${raw.slice(0, 200)}`);
    throw new Error(`Failed to parse LLM response as JSON for topic expansion: ${entry.title}`);
  }

  const result = TopicExpandOutputSchema.safeParse(jsonParsed);
  if (!result.success) {
    consola.error(`LLM output validation failed: ${result.error.message}`);
    throw new Error(`Invalid LLM output for topic expansion: ${entry.title}`);
  }

  consola.success(`Topic expansion generated for: ${entry.title}`);
  return result.data;
}
