import { z } from "zod";
import type { TopicCluster, PromptContext, LLMConfig } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate } from "./llm.js";
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

  const { system, user } = await loadPrompt(
    "digest-entry",
    {
      profile_name: profileName,
      interest_list: interestList.join(", "),
      cluster_json: JSON.stringify(cluster, null, 2),
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
    consola.error(`LLM returned non-JSON for cluster: ${cluster.label}`);
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
