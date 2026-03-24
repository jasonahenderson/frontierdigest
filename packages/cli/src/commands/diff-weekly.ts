import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "weekly",
    description: "Compare two weekly digests",
  },
  args: {
    current: {
      type: "string",
      description: "Date of the current digest (YYYY-MM-DD)",
      required: true,
    },
    previous: {
      type: "string",
      description: "Date of the previous digest (YYYY-MM-DD)",
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

      const currentDigest = await store.getDigest(args.current);
      const previousDigest = await store.getDigest(args.previous);

      if (!currentDigest) {
        consola.error(`No digest found for date: ${args.current}`);
        process.exitCode = 1;
        return;
      }
      if (!previousDigest) {
        consola.error(`No digest found for date: ${args.previous}`);
        process.exitCode = 1;
        return;
      }

      const currentEntries = await store.getDigestEntries(currentDigest.id);
      const previousEntries = await store.getDigestEntries(previousDigest.id);

      consola.box("Weekly Digest Comparison");

      // Side-by-side header
      consola.info(`Current (${args.current})          Previous (${args.previous})`);
      consola.info(`${"=".repeat(60)}`);

      // Counts
      consola.info(`Raw items:       ${String(currentDigest.raw_item_count).padEnd(20)} ${previousDigest.raw_item_count}`);
      consola.info(`Canonical items: ${String(currentDigest.canonical_item_count).padEnd(20)} ${previousDigest.canonical_item_count}`);
      consola.info(`Top items:       ${String(currentDigest.top_item_count).padEnd(20)} ${previousDigest.top_item_count}`);
      consola.info(`New themes:      ${String(currentDigest.new_theme_count).padEnd(20)} ${previousDigest.new_theme_count}`);
      consola.info(`Accelerating:    ${String(currentDigest.accelerating_count).padEnd(20)} ${previousDigest.accelerating_count}`);
      consola.info(`Cooling:         ${String(currentDigest.cooling_count).padEnd(20)} ${previousDigest.cooling_count}`);

      consola.info("");
      consola.info(`Current Entries (${currentEntries.length}):`);
      for (const entry of currentEntries) {
        consola.info(`  - ${entry.title} [${entry.novelty_label} novelty, ${entry.source_count} sources]`);
      }

      consola.info("");
      consola.info(`Previous Entries (${previousEntries.length}):`);
      for (const entry of previousEntries) {
        consola.info(`  - ${entry.title} [${entry.novelty_label} novelty, ${entry.source_count} sources]`);
      }

      // Find topics that appear in both
      const currentTitles = new Set(currentEntries.map((e) => e.title));
      const previousTitles = new Set(previousEntries.map((e) => e.title));
      const shared = [...currentTitles].filter((t) => previousTitles.has(t));

      if (shared.length > 0) {
        consola.info("");
        consola.info(`Shared topics (${shared.length}):`);
        for (const title of shared) {
          consola.info(`  - ${title}`);
        }
      }
    } catch (err) {
      consola.error("Diff failed:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
