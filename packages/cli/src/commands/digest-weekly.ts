import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "weekly",
    description: "Generate a weekly digest from ingested data",
  },
  args: {
    domain: {
      type: "string",
      description: "Path to domain config (alternative to --profile + --sources)",
    },
    profile: {
      type: "string",
      description: "Path to profile config",
      default: "configs/profile.sample.yaml",
    },
    sources: {
      type: "string",
      description: "Path to sources config",
      default: "configs/sources.sample.yaml",
    },
    date: {
      type: "string",
      description: "Date to generate digest for (YYYY-MM-DD, defaults to today)",
    },
  },
  async run({ args }) {
    try {
      const {
        createStore,
        dedupe,
        score,
        cluster,
        synthesize,
        validateConfigPath,
      } = await import("@frontier-digest/core");

      // Validate paths before use
      if (args.domain) {
        args.domain = validateConfigPath(args.domain);
      } else {
        args.profile = validateConfigPath(args.profile);
        args.sources = validateConfigPath(args.sources);
      }

      consola.info("Generating weekly digest from ingested data...");

      let profile, sources, promptContext, llmConfig;
      if (args.domain) {
        const { loadDomain, domainToProfileAndSources } = await import("@frontier-digest/core");
        const domainConfig = await loadDomain(args.domain);
        const resolved = domainToProfileAndSources(domainConfig);
        profile = resolved.profile;
        sources = resolved.sources;
        promptContext = resolved.promptContext;
        llmConfig = resolved.llmConfig;
        consola.info(`Domain: ${domainConfig.domain.name}`);
      } else {
        const { loadProfile, loadSources } = await import("@frontier-digest/core");
        profile = await loadProfile(args.profile);
        sources = await loadSources(args.sources);
        consola.info(`Profile: ${args.profile}`);
        consola.info(`Sources: ${args.sources}`);
      }

      const store = createStore(profile.outputs.root_dir);

      const today = args.date ?? new Date().toISOString().slice(0, 10);
      consola.info(`Date: ${today}`);

      // Load already-ingested normalized items from the store
      const normalizedItems = await store.getNormalizedItems(today);
      if (normalizedItems.length === 0) {
        consola.warn(
          `No normalized items found for ${today}. Run 'ingest' first, or check the date.`,
        );
        process.exitCode = 1;
        return;
      }
      consola.info(`Loaded ${normalizedItems.length} normalized items for ${today}`);

      // Dedupe
      consola.info("Deduplicating...");
      const dedupeResult = await dedupe(normalizedItems);
      consola.success(
        `Dedupe: ${dedupeResult.total_input} -> ${dedupeResult.total_canonical} canonical items`,
      );

      // Score
      consola.info("Scoring...");
      const scoredItems = await score(dedupeResult.canonical_items, profile, sources);
      consola.success(`Scored ${scoredItems.length} items`);

      // Cluster
      consola.info("Clustering...");
      const clusters = await cluster(scoredItems, profile);
      consola.success(`Clustered into ${clusters.length} topics`);

      // Synthesize
      consola.info("Synthesizing digest...");
      const synthesisResult = await synthesize(
        clusters,
        profile,
        store,
        today,
        normalizedItems.length,
        dedupeResult.total_canonical,
        undefined, // promptsDir - use default
        promptContext,
        llmConfig,
      );

      // Persist
      const { digest, entries, topicPacks, sourceBundles } = synthesisResult;
      await store.saveDigest(today, digest, entries);
      for (const pack of topicPacks) {
        await store.saveTopicPack(pack.topic_key, today, pack);
      }
      for (const bundle of sourceBundles) {
        await store.saveSourceBundle(bundle.topic_key, today, bundle);
      }

      consola.box("Digest Generated");
      consola.info(`Digest ID: ${digest.id}`);
      consola.info(`Entries: ${entries.length}`);
      consola.info(`Topic packs: ${topicPacks.length}`);
      consola.info(`Source bundles: ${sourceBundles.length}`);
      consola.info(`Summary: ${digest.summary}`);
      consola.info(`Artifacts: ${profile.outputs.root_dir}`);
    } catch (err) {
      consola.error("Digest generation failed:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
