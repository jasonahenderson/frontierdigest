import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "show",
    description: "Show topic pack details",
  },
  args: {
    "topic-id": {
      type: "positional",
      description: "Topic key to show",
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

      const topicKey = args["topic-id"];
      const pack = await store.getTopicPack(topicKey);

      if (!pack) {
        consola.error(`Topic pack not found: ${topicKey}`);
        process.exitCode = 1;
        return;
      }

      consola.box(pack.title);
      consola.info(`Topic key: ${pack.topic_key}`);
      consola.info(`Source bundle ref: ${pack.source_bundle_ref}`);

      consola.info("");
      consola.info("Expanded Summary:");
      consola.info(`  ${pack.expanded_summary}`);

      consola.info("");
      consola.info("Why Included:");
      for (const reason of pack.why_included) {
        consola.info(`  - ${reason}`);
      }

      consola.info("");
      consola.info("What Is New:");
      for (const item of pack.what_is_new) {
        consola.info(`  - ${item}`);
      }

      consola.info("");
      consola.info("Uncertainties:");
      for (const u of pack.uncertainties) {
        consola.info(`  - ${u}`);
      }

      if (pack.related_topics.length > 0) {
        consola.info("");
        consola.info("Related Topics:");
        for (const t of pack.related_topics) {
          consola.info(`  - ${t}`);
        }
      }
    } catch (err) {
      consola.error("Failed to show topic:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
