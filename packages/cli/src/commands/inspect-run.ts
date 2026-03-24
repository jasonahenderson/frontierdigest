import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "run",
    description: "Inspect a pipeline run manifest",
  },
  args: {
    "run-id": {
      type: "positional",
      description: "Run ID to inspect",
      required: true,
    },
    profile: {
      type: "string",
      description: "Path to profile config",
      default: "configs/profile.sample.yaml",
    },
  },
  async run({ args }) {
    try {
      const { loadProfile, createStore } = await import("@frontier-digest/core");

      const profile = await loadProfile(args.profile);
      const store = createStore(profile.outputs.root_dir);

      const runId = args["run-id"];
      const manifest = await store.getRunManifest(runId);

      if (!manifest) {
        consola.error(`Run manifest not found: ${runId}`);
        process.exitCode = 1;
        return;
      }

      consola.box(`Run: ${manifest.id}`);
      consola.info(`Status: ${manifest.status}`);
      consola.info(`Started: ${manifest.started_at}`);
      if (manifest.completed_at) {
        consola.info(`Completed: ${manifest.completed_at}`);

        // Calculate duration
        const startMs = new Date(manifest.started_at).getTime();
        const endMs = new Date(manifest.completed_at).getTime();
        const durationSec = ((endMs - startMs) / 1000).toFixed(1);
        consola.info(`Duration: ${durationSec}s`);
      }

      consola.info("");
      consola.info("Steps:");
      consola.info(
        `${"Name".padEnd(20)} ${"Status".padEnd(12)} ${"Items".padEnd(8)} ${"Time"}`,
      );
      consola.info(
        `${"─".repeat(20)} ${"─".repeat(12)} ${"─".repeat(8)} ${"─".repeat(20)}`,
      );

      for (const step of manifest.steps) {
        const items = step.item_count != null ? String(step.item_count) : "-";
        let timing = "-";
        if (step.started_at && step.completed_at) {
          const startMs = new Date(step.started_at).getTime();
          const endMs = new Date(step.completed_at).getTime();
          timing = `${((endMs - startMs) / 1000).toFixed(1)}s`;
        }
        const statusIcon =
          step.status === "completed" ? "ok" : step.status === "failed" ? "FAIL" : "skip";

        consola.info(
          `${step.name.padEnd(20)} ${statusIcon.padEnd(12)} ${items.padEnd(8)} ${timing}`,
        );

        if (step.error) {
          consola.error(`  Error: ${step.error}`);
        }
      }
    } catch (err) {
      consola.error("Failed to inspect run:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
