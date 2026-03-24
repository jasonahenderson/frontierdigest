import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "weekly",
    description: "Run the full weekly digest pipeline",
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
      const { createStore, runWeeklyPipeline, validateConfigPath } = await import("@frontier-digest/core");

      // Validate paths before use
      if (args.domain) {
        args.domain = validateConfigPath(args.domain);
      } else {
        args.profile = validateConfigPath(args.profile);
        args.sources = validateConfigPath(args.sources);
      }

      consola.info("Running weekly digest pipeline...");

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

      const manifest = await runWeeklyPipeline(profile, sources, store, promptContext, llmConfig);

      consola.box(`Run Complete: ${manifest.id}`);
      consola.info(`Status: ${manifest.status}`);
      consola.info(`Started: ${manifest.started_at}`);
      if (manifest.completed_at) {
        consola.info(`Completed: ${manifest.completed_at}`);
      }

      for (const step of manifest.steps) {
        const icon = step.status === "completed" ? "+" : step.status === "failed" ? "x" : "-";
        const count = step.item_count != null ? ` (${step.item_count} items)` : "";
        consola.info(`  [${icon}] ${step.name}: ${step.status}${count}`);
      }

      consola.info(`Artifacts directory: ${profile.outputs.root_dir}`);

      if (manifest.status === "failed") {
        process.exitCode = 1;
      }
    } catch (err) {
      consola.error("Weekly pipeline failed:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
