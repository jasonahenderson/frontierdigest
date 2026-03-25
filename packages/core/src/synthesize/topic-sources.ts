import { z } from "zod";
import { SourceEvidenceSchema } from "../types/index.js";
import type { TopicCluster, SourceEvidence, PromptContext, LLMConfig } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate, extractJson } from "./llm.js";
import { consola } from "consola";

const SourceBundleResponseSchema = z.object({
  sources: z.array(SourceEvidenceSchema),
});

export async function generateSourceBundle(
  cluster: TopicCluster,
  entryTitle: string,
  promptsDir: string,
  promptContext?: PromptContext,
  llmConfig?: LLMConfig,
): Promise<SourceEvidence[]> {
  consola.info(`Generating source bundle for: ${entryTitle}`);

  const trimmedCluster = {
    label: cluster.label,
    items: cluster.items.slice(0, 5).map(si => ({
      title: si.item.title,
      url: si.item.url,
      source_name: si.item.source_name,
      excerpt: si.item.excerpt,
      tags: si.item.tags,
    })),
  };

  const { system, user } = await loadPrompt(
    "topic-sources",
    {
      entry_title: entryTitle,
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
    consola.error(`LLM returned non-JSON for source bundle: ${entryTitle}: ${raw.slice(0, 200)}`);
    throw new Error(`Failed to parse LLM response as JSON for source bundle: ${entryTitle}`);
  }

  const result = SourceBundleResponseSchema.safeParse(jsonParsed);
  if (!result.success) {
    consola.error(`LLM output validation failed: ${result.error.message}`);
    throw new Error(`Invalid LLM output for source bundle: ${entryTitle}`);
  }

  consola.success(
    `Source bundle generated: ${result.data.sources.length} sources for "${entryTitle}"`,
  );
  return result.data.sources;
}
