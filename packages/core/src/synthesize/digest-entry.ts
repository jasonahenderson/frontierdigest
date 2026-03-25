import { z } from "zod";
import type { TopicCluster, PromptContext, LLMConfig } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate, extractJson } from "./llm.js";
import { consola } from "consola";

const DigestEntryOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  why_it_matters: z.string(),
  novelty_label: z.enum(["high", "medium", "low"]),
  confidence_label: z.enum(["high", "medium", "low"]),
});

export type DigestEntryOutput = z.infer<typeof DigestEntryOutputSchema>;

export async function generateDigestEntry(
  cluster: TopicCluster,
  interestList: string[],
  profileName: string,
  promptsDir: string,
  promptContext?: PromptContext,
  llmConfig?: LLMConfig,
): Promise<DigestEntryOutput> {
  consola.info(`Generating digest entry for cluster: ${cluster.label}`);

  // Truncate cluster data to avoid overwhelming the LLM
  const trimmedCluster = {
    label: cluster.label,
    tags: cluster.tags,
    aggregate_score: cluster.aggregate_score,
    primary_source_count: cluster.primary_source_count,
    items: cluster.items.slice(0, 5).map(si => ({
      title: si.item.title,
      source_name: si.item.source_name,
      excerpt: si.item.excerpt,
      tags: si.item.tags,
      total_score: si.total_score,
    })),
  };

  const { system, user } = await loadPrompt(
    "digest-entry",
    {
      profile_name: profileName,
      interest_list: interestList.join(", "),
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
    consola.error(`LLM returned non-JSON for cluster: ${cluster.label}: ${raw.slice(0, 200)}`);
    throw new Error(`Failed to parse LLM response as JSON for cluster: ${cluster.label}`);
  }

  const result = DigestEntryOutputSchema.safeParse(jsonParsed);
  if (!result.success) {
    consola.error(`LLM output validation failed: ${result.error.message}`);
    throw new Error(`Invalid LLM output for cluster: ${cluster.label}`);
  }

  consola.success(`Digest entry generated: ${result.data.title}`);
  return result.data;
}
