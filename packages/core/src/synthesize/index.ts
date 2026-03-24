import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { consola } from "consola";
import type {
  TopicCluster,
  DigestEntry,
  TopicPack,
  WeeklyDigest,
  SourceBundle,
  ProfileConfig,
} from "../types/index.js";
import type { Store } from "../persist/index.js";
import { generateDigestEntry } from "./digest-entry.js";
import { generateTopicExpansion } from "./topic-expand.js";
import { generateSourceBundle } from "./topic-sources.js";
import { generateComparison } from "./compare.js";
import { generateWeeklySummary } from "./weekly-summary.js";

export interface SynthesisResult {
  digest: WeeklyDigest;
  entries: DigestEntry[];
  topicPacks: TopicPack[];
  sourceBundles: SourceBundle[];
}

export async function synthesize(
  clusters: TopicCluster[],
  profile: ProfileConfig,
  store: Store,
  date: string,
  rawItemCount: number,
  canonicalItemCount: number,
  promptsDir?: string,
): Promise<SynthesisResult> {
  const resolvedPromptsDir =
    promptsDir ?? resolve(import.meta.dirname, "../../../../prompts");
  const interestList = profile.interests.include;
  const profileName = profile.profile;

  consola.start(
    `Synthesizing digest for ${clusters.length} clusters (${date})`,
  );

  // --- Step 1: Generate digest entries for each cluster (parallel) ---
  consola.info("Step 1: Generating digest entries...");
  const entryOutputs = await Promise.all(
    clusters.map((cluster) =>
      generateDigestEntry(cluster, interestList, profileName, resolvedPromptsDir),
    ),
  );

  // Assemble full DigestEntry objects
  const entries: DigestEntry[] = entryOutputs.map((output, i) => {
    const cluster = clusters[i];
    return {
      id: `entry-${randomUUID()}`,
      title: output.title,
      summary: output.summary,
      why_it_matters: output.why_it_matters,
      novelty_label: output.novelty_label,
      confidence_label: output.confidence_label,
      source_count: cluster.items.length,
      primary_source_count: cluster.primary_source_count,
      source_ids: cluster.item_ids,
      topic_ids: [cluster.id],
    };
  });

  // --- Step 2: Generate topic expansions (parallel) ---
  consola.info("Step 2: Generating topic expansions...");
  const expandOutputs = await Promise.all(
    entries.map((entry, i) =>
      generateTopicExpansion(
        entry,
        clusters[i],
        interestList,
        resolvedPromptsDir,
      ),
    ),
  );

  // --- Step 3: Generate source bundles (parallel) ---
  consola.info("Step 3: Generating source bundles...");
  const sourceBundleSources = await Promise.all(
    clusters.map((cluster, i) =>
      generateSourceBundle(cluster, entries[i].title, resolvedPromptsDir),
    ),
  );

  // Assemble SourceBundle and TopicPack objects
  const sourceBundles: SourceBundle[] = sourceBundleSources.map(
    (sources, i) => ({
      id: `sb-${randomUUID()}`,
      topic_key: clusters[i].label,
      date,
      sources,
    }),
  );

  const topicPacks: TopicPack[] = expandOutputs.map((output, i) => ({
    id: `tp-${randomUUID()}`,
    topic_key: clusters[i].label,
    title: entries[i].title,
    expanded_summary: output.expanded_summary,
    why_included: output.why_included,
    what_is_new: output.what_is_new,
    uncertainties: output.uncertainties,
    source_bundle_ref: sourceBundles[i].id,
    related_topics: output.related_topics,
  }));

  // --- Step 4: Generate comparisons with previous week (parallel) ---
  consola.info("Step 4: Generating week-over-week comparisons...");
  const comparisons = await Promise.all(
    entries.map(async (entry, i) => {
      const cluster = clusters[i];
      const previousTopic = await store.getTopicPack(cluster.label);
      return generateComparison(
        entry,
        cluster,
        previousTopic,
        resolvedPromptsDir,
      );
    }),
  );

  // Attach comparison refs to entries
  for (let i = 0; i < entries.length; i++) {
    if (comparisons[i]) {
      entries[i].comparison_ref = `comparison-${clusters[i].label}-${date}`;
    }
  }

  // --- Step 5: Generate weekly summary ---
  consola.info("Step 5: Generating weekly summary...");
  const windowEnd = new Date(date).toISOString();
  const windowStart = new Date(
    new Date(date).getTime() -
      profile.window.weekly_lookback_days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const summaryOutput = await generateWeeklySummary(
    {
      entries,
      windowStart,
      windowEnd,
      rawItemCount,
      canonicalItemCount,
      topItemCount: entries.length,
    },
    resolvedPromptsDir,
  );

  // --- Step 6: Assemble WeeklyDigest ---
  const digest: WeeklyDigest = {
    id: `digest-${randomUUID()}`,
    generated_at: new Date().toISOString(),
    window_start: windowStart,
    window_end: windowEnd,
    raw_item_count: rawItemCount,
    canonical_item_count: canonicalItemCount,
    top_item_count: entries.length,
    summary: summaryOutput.summary,
    entries: entries.map((e) => e.id),
    new_theme_count: summaryOutput.new_theme_count,
    accelerating_count: summaryOutput.accelerating_count,
    cooling_count: summaryOutput.cooling_count,
    run_ref: `run-${date}`,
  };

  consola.success(`Synthesis complete: ${entries.length} entries generated`);

  return { digest, entries, topicPacks, sourceBundles };
}

// Re-export all functions and types
export { getClient, llmGenerate } from "./llm.js";
export { loadPrompt } from "./prompt-loader.js";
export {
  generateWeeklySummary,
  type WeeklySummaryInput,
  type WeeklySummaryOutput,
} from "./weekly-summary.js";
export {
  generateDigestEntry,
  type DigestEntryOutput,
} from "./digest-entry.js";
export {
  generateTopicExpansion,
  type TopicExpandOutput,
} from "./topic-expand.js";
export { generateSourceBundle } from "./topic-sources.js";
export {
  generateComparison,
  type ComparisonOutput,
} from "./compare.js";
