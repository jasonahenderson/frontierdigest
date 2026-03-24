import type { TopicCluster, PromptContext, LLMConfig } from "../types/index.js";
import { loadPrompt } from "./prompt-loader.js";
import { llmGenerate } from "./llm.js";
import { consola } from "consola";

export interface DigestEntryOutput {
  title: string;
  summary: string;
  why_it_matters: string;
  novelty_label: "high" | "medium" | "low";
  confidence_label: "high" | "medium" | "low";
}

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
  const parsed = JSON.parse(raw) as DigestEntryOutput;

  // Validate required fields
  if (
    typeof parsed.title !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.why_it_matters !== "string" ||
    !["high", "medium", "low"].includes(parsed.novelty_label) ||
    !["high", "medium", "low"].includes(parsed.confidence_label)
  ) {
    throw new Error(
      `Digest entry response invalid for cluster: ${cluster.label}`,
    );
  }

  consola.success(`Digest entry generated: ${parsed.title}`);
  return parsed;
}
