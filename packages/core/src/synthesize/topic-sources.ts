import type { TopicCluster, SourceEvidence } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate } from "./llm.js";
import { consola } from "consola";

export async function generateSourceBundle(
  cluster: TopicCluster,
  entryTitle: string,
  promptsDir: string,
): Promise<SourceEvidence[]> {
  consola.info(`Generating source bundle for: ${entryTitle}`);

  const { system, user } = await loadPrompt(
    "topic-sources",
    {
      entry_title: entryTitle,
      cluster_json: JSON.stringify(cluster, null, 2),
    },
    promptsDir,
  );

  const raw = await llmGenerate(system, user);
  const parsed = JSON.parse(raw) as { sources: SourceEvidence[] };

  if (!Array.isArray(parsed.sources)) {
    throw new Error(
      `Source bundle response invalid for entry: ${entryTitle}`,
    );
  }

  consola.success(
    `Source bundle generated: ${parsed.sources.length} sources for "${entryTitle}"`,
  );
  return parsed.sources;
}
