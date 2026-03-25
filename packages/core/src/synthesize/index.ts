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
  PromptContext,
  LLMConfig,
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
  promptContext?: PromptContext,
  llmConfig?: LLMConfig,
): Promise<SynthesisResult> {
  const resolvedPromptsDir =
    promptsDir ?? resolve(import.meta.dirname, "../../../../prompts");
  const interestList = profile.interests.include;
  const profileName = profile.profile;

  consola.start(
    `Synthesizing digest for ${clusters.length} clusters (${date})`,
  );

  // --- Step 1: Generate digest entries for each cluster ---
  // Sequential for local models (Ollama), parallel for cloud APIs
  const isLocal = llmConfig?.provider === "ollama";
  consola.info(`Step 1: Generating digest entries${isLocal ? " (sequential — local model)" : ""}...`);
  const entryOutputs: Awaited<ReturnType<typeof generateDigestEntry>>[] = [];
  if (isLocal) {
    for (const c of clusters) {
      entryOutputs.push(await generateDigestEntry(c, interestList, profileName, resolvedPromptsDir, promptContext, llmConfig));
    }
  } else {
    entryOutputs.push(...await Promise.all(
      clusters.map((c) =>
        generateDigestEntry(c, interestList, profileName, resolvedPromptsDir, promptContext, llmConfig),
      ),
    ));
  }

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

  // --- Step 2: Generate topic expansions (graceful failures) ---
  consola.info(`Step 2: Generating topic expansions${isLocal ? " (sequential)" : ""}...`);
  const defaultExpansion = { expanded_summary: "", why_included: [], what_is_new: [], uncertainties: [], related_topics: [] };
  const expandOutputs: Awaited<ReturnType<typeof generateTopicExpansion>>[] = [];
  for (let i = 0; i < entries.length; i++) {
    try {
      if (isLocal) {
        expandOutputs.push(await generateTopicExpansion(entries[i], clusters[i], interestList, resolvedPromptsDir, promptContext, llmConfig));
      } else {
        expandOutputs.push(await generateTopicExpansion(entries[i], clusters[i], interestList, resolvedPromptsDir, promptContext, llmConfig));
      }
    } catch (err) {
      consola.warn(`Topic expansion failed for "${entries[i].title}", using fallback`);
      expandOutputs.push({ ...defaultExpansion, expanded_summary: entries[i].summary });
    }
  }

  // --- Step 3: Generate source bundles (graceful failures) ---
  consola.info(`Step 3: Generating source bundles${isLocal ? " (sequential)" : ""}...`);
  const sourceBundleSources: Awaited<ReturnType<typeof generateSourceBundle>>[] = [];
  for (let i = 0; i < clusters.length; i++) {
    try {
      sourceBundleSources.push(await generateSourceBundle(clusters[i], entries[i].title, resolvedPromptsDir, promptContext, llmConfig));
    } catch (err) {
      consola.warn(`Source bundle failed for "${entries[i].title}", using fallback`);
      sourceBundleSources.push(clusters[i].items.slice(0, 5).map(si => ({
        item_id: si.item.id,
        title: si.item.title,
        url: si.item.url,
        source_name: si.item.source_name,
        is_primary: false,
        excerpt: si.item.excerpt,
      })));
    }
  }

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

  // --- Step 4: Generate comparisons with previous week (graceful) ---
  consola.info("Step 4: Generating week-over-week comparisons...");
  const defaultComparison = { previous_framing: "N/A", current_framing: "", detected_shifts: [], trend_interpretation: "First week of tracking." };
  const comparisons: Awaited<ReturnType<typeof generateComparison>>[] = [];
  for (let i = 0; i < entries.length; i++) {
    try {
      const previousTopic = await store.getTopicPack(clusters[i].label);
      comparisons.push(await generateComparison(entries[i], clusters[i], previousTopic, resolvedPromptsDir, promptContext, llmConfig));
    } catch {
      consola.warn(`Comparison failed for "${entries[i].title}", using fallback`);
      comparisons.push({ ...defaultComparison, current_framing: entries[i].summary });
    }
  }

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

  let summaryOutput = { summary: `Weekly digest: ${entries.length} topics from ${rawItemCount} sources.`, new_theme_count: entries.length, accelerating_count: 0, cooling_count: 0 };
  try {
    summaryOutput = await generateWeeklySummary(
      {
        entries,
        windowStart,
        windowEnd,
        rawItemCount,
        canonicalItemCount,
        topItemCount: entries.length,
      },
      resolvedPromptsDir,
      promptContext,
      llmConfig,
    );
  } catch {
    consola.warn("Weekly summary generation failed, using fallback");
  }

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
export { llmGenerate, createModel, resolveConfig, extractJson } from "./llm.js";
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
