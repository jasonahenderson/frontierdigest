import type { DigestEntry, TopicCluster, TopicPack } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate } from "./llm.js";
import { consola } from "consola";

export interface ComparisonOutput {
  previous_framing: string;
  current_framing: string;
  detected_shifts: string[];
  trend_interpretation: string;
}

export async function generateComparison(
  currentEntry: DigestEntry,
  currentCluster: TopicCluster,
  previousTopic: TopicPack | null,
  promptsDir: string,
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
  );

  const raw = await llmGenerate(system, user);
  const parsed = JSON.parse(raw) as ComparisonOutput;

  // Validate required fields
  if (
    typeof parsed.previous_framing !== "string" ||
    typeof parsed.current_framing !== "string" ||
    !Array.isArray(parsed.detected_shifts) ||
    typeof parsed.trend_interpretation !== "string"
  ) {
    throw new Error(
      `Comparison response invalid for entry: ${currentEntry.title}`,
    );
  }

  consola.success(`Comparison generated for: ${currentEntry.title}`);
  return parsed;
}
