import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "ingest",
    description: "Ingest sources for the current time window",
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
  },
  async run({ args }) {
    try {
      const { createStore, ingest } = await import("@frontier-digest/core");

      consola.info("Ingesting sources...");

      let profile, sources;
      if (args.domain) {
        const { loadDomain, domainToProfileAndSources } = await import("@frontier-digest/core");
        const domainConfig = await loadDomain(args.domain);
        const resolved = domainToProfileAndSources(domainConfig);
        profile = resolved.profile;
        sources = resolved.sources;
        consola.info(`Domain: ${domainConfig.domain.name}`);
      } else {
        const { loadProfile, loadSources } = await import("@frontier-digest/core");
        profile = await loadProfile(args.profile);
        sources = await loadSources(args.sources);
        consola.info(`Profile: ${args.profile}`);
        consola.info(`Sources: ${args.sources}`);
      }

      const store = createStore(profile.outputs.root_dir);

      const rawItems = await ingest(profile, sources);

      // Save raw items grouped by source
      const today = new Date().toISOString().slice(0, 10);
      const bySource = new Map<string, typeof rawItems>();
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

      // Log results
      consola.success(`Ingest complete`);
      consola.info(`Sources processed: ${sources.length}`);
      for (const [sourceId, items] of bySource) {
        consola.info(`  ${sourceId}: ${items.length} items`);
      }
      consola.info(`Total items: ${rawItems.length}`);
    } catch (err) {
      consola.error("Ingest failed:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
