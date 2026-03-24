import { consola } from "consola";
import type {
  ProfileConfig,
  SourceConfig,
  RunManifest,
  NormalizedItem,
  ScoredItem,
  TopicCluster,
  DedupeResult,
  PromptContext,
} from "../types/index.js";
import type { Store } from "../persist/index.js";
import type { RawItem } from "../normalize/index.js";
import type { SynthesisResult } from "../synthesize/index.js";
import { ingest } from "../ingest/index.js";
import { normalize } from "../normalize/index.js";
import { dedupe } from "../dedupe/index.js";
import { score } from "../score/index.js";
import { cluster } from "../cluster/index.js";
import { synthesize } from "../synthesize/index.js";
import { generateRunId } from "../persist/id-gen.js";
import { RunTracker } from "./run-tracker.js";

export { RunTracker } from "./run-tracker.js";

export async function runWeeklyPipeline(
  profile: ProfileConfig,
  sources: SourceConfig[],
  store: Store,
  promptContext?: PromptContext,
): Promise<RunManifest> {
  const today = new Date().toISOString().slice(0, 10);
  const runId = generateRunId(today);
  const tracker = new RunTracker(
    runId,
    JSON.parse(JSON.stringify(profile)) as Record<string, unknown>,
  );

  consola.box(`Frontier Digest Pipeline — Run ${runId}`);

  let rawItems: RawItem[] = [];
  let normalizedItems: NormalizedItem[] = [];
  let dedupeResult: DedupeResult | null = null;
  let scoredItems: ScoredItem[] = [];
  let clusters: TopicCluster[] = [];
  let synthesisResult: SynthesisResult | null = null;

  // Step 1: Ingest
  const stepIngest = "ingest";
  consola.info("Step 1/8: Ingesting sources...");
  tracker.startStep(stepIngest);
  try {
    rawItems = await ingest(profile, sources);

    // Save raw items grouped by source
    const bySource = new Map<string, RawItem[]>();
    for (const item of rawItems) {
      const group = bySource.get(item.source_id);
      if (group) {
        group.push(item);
      } else {
        bySource.set(item.source_id, [item]);
      }
    }
    for (const [sourceId, items] of bySource) {
      await store.saveRawItems(today, sourceId, items);
    }

    tracker.completeStep(stepIngest, rawItems.length);
    consola.success(`Ingest complete: ${rawItems.length} raw items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Ingest failed: ${msg}`);
    tracker.failStep(stepIngest, msg);
  }

  // Step 2: Normalize
  const stepNormalize = "normalize";
  consola.info("Step 2/8: Normalizing items...");
  tracker.startStep(stepNormalize);
  try {
    if (rawItems.length === 0) {
      consola.warn("No raw items to normalize, skipping.");
      tracker.completeStep(stepNormalize, 0);
    } else {
      normalizedItems = await normalize(rawItems);
      await store.saveNormalizedItems(today, normalizedItems);
      tracker.completeStep(stepNormalize, normalizedItems.length);
      consola.success(
        `Normalize complete: ${normalizedItems.length} normalized items`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Normalize failed: ${msg}`);
    tracker.failStep(stepNormalize, msg);
  }

  // Step 3: Dedupe
  const stepDedupe = "dedupe";
  consola.info("Step 3/8: Deduplicating items...");
  tracker.startStep(stepDedupe);
  try {
    if (normalizedItems.length === 0) {
      consola.warn("No normalized items to dedupe, skipping.");
      tracker.completeStep(stepDedupe, 0);
    } else {
      dedupeResult = await dedupe(normalizedItems);
      tracker.completeStep(stepDedupe, dedupeResult.total_canonical);
      consola.success(
        `Dedupe complete: ${dedupeResult.total_input} -> ${dedupeResult.total_canonical} canonical items (${dedupeResult.clusters.length} clusters)`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Dedupe failed: ${msg}`);
    tracker.failStep(stepDedupe, msg);
  }

  // Step 4: Score
  const stepScore = "score";
  consola.info("Step 4/8: Scoring items...");
  tracker.startStep(stepScore);
  try {
    const canonical = dedupeResult?.canonical_items ?? normalizedItems;
    if (canonical.length === 0) {
      consola.warn("No items to score, skipping.");
      tracker.completeStep(stepScore, 0);
    } else {
      scoredItems = await score(canonical, profile, sources);
      tracker.completeStep(stepScore, scoredItems.length);
      consola.success(`Score complete: ${scoredItems.length} scored items`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Score failed: ${msg}`);
    tracker.failStep(stepScore, msg);
  }

  // Step 5: Cluster
  const stepCluster = "cluster";
  consola.info("Step 5/8: Clustering topics...");
  tracker.startStep(stepCluster);
  try {
    if (scoredItems.length === 0) {
      consola.warn("No scored items to cluster, skipping.");
      tracker.completeStep(stepCluster, 0);
    } else {
      clusters = await cluster(scoredItems, profile);
      tracker.completeStep(stepCluster, clusters.length);
      consola.success(`Cluster complete: ${clusters.length} topic clusters`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Cluster failed: ${msg}`);
    tracker.failStep(stepCluster, msg);
  }

  // Step 6: Synthesize
  const stepSynthesize = "synthesize";
  consola.info("Step 6/8: Synthesizing digest...");
  tracker.startStep(stepSynthesize);
  try {
    if (clusters.length === 0) {
      consola.warn("No clusters to synthesize, skipping.");
      tracker.completeStep(stepSynthesize, 0);
    } else {
      synthesisResult = await synthesize(
        clusters,
        profile,
        store,
        today,
        rawItems.length,
        dedupeResult?.total_canonical ?? normalizedItems.length,
        undefined, // promptsDir - use default
        promptContext,
      );
      tracker.completeStep(stepSynthesize, synthesisResult.entries.length);
      consola.success(
        `Synthesize complete: ${synthesisResult.entries.length} entries`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Synthesize failed: ${msg}`);
    tracker.failStep(stepSynthesize, msg);
  }

  // Step 7: Persist
  const stepPersist = "persist";
  consola.info("Step 7/8: Persisting results...");
  tracker.startStep(stepPersist);
  try {
    if (synthesisResult) {
      const { digest, entries, topicPacks, sourceBundles } = synthesisResult;

      await store.saveDigest(today, digest, entries);

      for (const pack of topicPacks) {
        await store.saveTopicPack(pack.topic_key, today, pack);
      }

      for (const bundle of sourceBundles) {
        await store.saveSourceBundle(bundle.topic_key, today, bundle);
      }

      tracker.completeStep(stepPersist, entries.length);
      consola.success(
        `Persist complete: digest + ${entries.length} entries + ${topicPacks.length} topic packs + ${sourceBundles.length} source bundles`,
      );
    } else {
      consola.warn("No synthesis result to persist, skipping.");
      tracker.completeStep(stepPersist, 0);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Persist failed: ${msg}`);
    tracker.failStep(stepPersist, msg);
  }

  // Step 8: Complete
  const stepComplete = "save_manifest";
  consola.info("Step 8/8: Saving run manifest...");
  tracker.startStep(stepComplete);
  try {
    const hasFailures = tracker
      .getManifest()
      .steps.some((s) => s.status === "failed");
    const manifest = hasFailures
      ? tracker.fail("One or more steps failed")
      : tracker.complete();

    await store.saveRunManifest(manifest);
    tracker.completeStep(stepComplete);
    consola.success(`Run ${runId} ${manifest.status}`);
    return manifest;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consola.error(`Failed to save run manifest: ${msg}`);
    tracker.failStep(stepComplete, msg);
    return tracker.fail(msg);
  }
}
