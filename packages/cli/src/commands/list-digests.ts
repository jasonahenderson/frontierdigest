import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "digests",
    description: "List available digests from the store",
  },
  args: {
    limit: {
      type: "string",
      description: "Maximum number of digests to list",
      default: "10",
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

      const digests = await store.listDigests();
      const limit = parseInt(args.limit, 10) || 10;
      const displayed = digests.slice(0, limit);

      if (displayed.length === 0) {
        consola.info("No digests found in the store.");
        return;
      }

      consola.box(`Digests (${displayed.length} of ${digests.length})`);

      // Table header
      consola.info(`${"Date".padEnd(14)} ${"ID"}`);
      consola.info(`${"─".repeat(14)} ${"─".repeat(40)}`);

      for (const digest of displayed) {
        consola.info(`${digest.date.padEnd(14)} ${digest.id}`);
      }
    } catch (err) {
      consola.error("Failed to list digests:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
