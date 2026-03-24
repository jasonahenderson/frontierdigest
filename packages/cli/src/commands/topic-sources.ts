import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "sources",
    description: "Show sources for a topic",
  },
  args: {
    "topic-id": {
      type: "positional",
      description: "Topic key to show sources for",
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

      // First get the topic pack to find the source bundle ref
      const pack = await store.getTopicPack(topicKey);
      if (!pack) {
        consola.error(`Topic pack not found: ${topicKey}`);
        process.exitCode = 1;
        return;
      }

      const bundle = await store.getSourceBundle(pack.source_bundle_ref);
      if (!bundle) {
        consola.error(`Source bundle not found: ${pack.source_bundle_ref}`);
        process.exitCode = 1;
        return;
      }

      consola.box(`Sources for: ${pack.title}`);
      consola.info(`Topic key: ${bundle.topic_key}`);
      consola.info(`Date: ${bundle.date}`);
      consola.info(`Total sources: ${bundle.sources.length}`);
      consola.info("");

      for (const source of bundle.sources) {
        const primaryTag = source.is_primary ? " [PRIMARY]" : "";
        consola.info(`${source.title}${primaryTag}`);
        consola.info(`  Source: ${source.source_name}`);
        consola.info(`  URL: ${source.url}`);
        if (source.excerpt) {
          consola.info(`  Excerpt: ${source.excerpt.slice(0, 200)}${source.excerpt.length > 200 ? "..." : ""}`);
        }
        if (source.relevance_note) {
          consola.info(`  Relevance: ${source.relevance_note}`);
        }
        consola.info("");
      }
    } catch (err) {
      consola.error("Failed to show sources:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
