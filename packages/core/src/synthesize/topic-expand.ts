import type { DigestEntry, TopicCluster, PromptContext } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate } from "./llm.js";
import { consola } from "consola";

export interface TopicExpandOutput {
  expanded_summary: string;
  why_included: string[];
  what_is_new: string[];
  uncertainties: string[];
  related_topics: string[];
}

export async function generateTopicExpansion(
  entry: DigestEntry,
  cluster: TopicCluster,
  interestList: string[],
  promptsDir: string,
  promptContext?: PromptContext,
): Promise<TopicExpandOutput> {
  consola.info(`Generating topic expansion for: ${entry.title}`);

  const { system, user } = await loadPrompt(
    "topic-expand",
    {
      interest_list: interestList.join(", "),
      entry_json: JSON.stringify(entry, null, 2),
      cluster_json: JSON.stringify(cluster, null, 2),
    },
    promptsDir,
    promptContext,
  );

  const raw = await llmGenerate(system, user);
  const parsed = JSON.parse(raw) as TopicExpandOutput;

  // Validate required fields
  if (
    typeof parsed.expanded_summary !== "string" ||
    !Array.isArray(parsed.why_included) ||
    !Array.isArray(parsed.what_is_new) ||
    !Array.isArray(parsed.uncertainties) ||
    !Array.isArray(parsed.related_topics)
  ) {
    throw new Error(
      `Topic expansion response invalid for entry: ${entry.title}`,
    );
  }

  consola.success(`Topic expansion generated for: ${entry.title}`);
  return parsed;
}
