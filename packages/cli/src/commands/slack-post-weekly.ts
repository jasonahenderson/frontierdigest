import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "weekly",
    description: "Post weekly digest to Slack",
  },
  args: {
    domain: {
      type: "string",
      description: "Path to domain config (alternative to --profile)",
    },
    profile: {
      type: "string",
      description: "Path to profile config",
      default: "configs/profile.sample.yaml",
    },
    channel: {
      type: "string",
      description: "Slack channel to post to (overrides profile config)",
    },
    date: {
      type: "string",
      description: "Date of the digest to post (YYYY-MM-DD, defaults to latest)",
    },
  },
  async run({ args }) {
    try {
      const { createStore } = await import("@frontier-digest/core");
      const { postWeeklyDigest } = await import("@frontier-digest/slack");

      consola.info("Posting weekly digest to Slack...");

      let profile, slackChannel: string | undefined, slackPostThreads: boolean | undefined;
      if (args.domain) {
        const { loadDomain, domainToProfileAndSources } = await import("@frontier-digest/core");
        const domainConfig = await loadDomain(args.domain);
        const resolved = domainToProfileAndSources(domainConfig);
        profile = resolved.profile;
        slackChannel = domainConfig.domain.slack?.channel;
        slackPostThreads = domainConfig.domain.slack?.post_threads;
        consola.info(`Domain: ${domainConfig.domain.name}`);
      } else {
        const { loadProfile } = await import("@frontier-digest/core");
        profile = await loadProfile(args.profile);
        slackChannel = profile.slack.channel;
        slackPostThreads = profile.slack.post_threads;
      }

      const store = createStore(profile.outputs.root_dir);

      // Load digest
      let digest;
      if (args.date) {
        digest = await store.getDigest(args.date);
      } else {
        digest = await store.getLatestDigest();
      }

      if (!digest) {
        consola.error("No digest found. Run the pipeline first.");
        process.exitCode = 1;
        return;
      }

      // Load entries for the digest
      const entries = await store.getDigestEntries(digest.id);
      if (entries.length === 0) {
        consola.warn("Digest has no entries.");
      }

      // Build Slack config from environment variables
      const botToken = process.env.SLACK_BOT_TOKEN;
      const signingSecret = process.env.SLACK_SIGNING_SECRET;
      const channel = args.channel ?? slackChannel;

      if (!botToken) {
        consola.error("SLACK_BOT_TOKEN environment variable is required");
        process.exitCode = 1;
        return;
      }
      if (!signingSecret) {
        consola.error("SLACK_SIGNING_SECRET environment variable is required");
        process.exitCode = 1;
        return;
      }

      const slackConfig = {
        bot_token: botToken,
        signing_secret: signingSecret,
        app_token: process.env.SLACK_APP_TOKEN,
        channel,
        post_threads: slackPostThreads,
      };

      consola.info(`Posting to channel: ${channel}`);
      consola.info(`Digest: ${digest.id} (${digest.generated_at})`);

      const result = await postWeeklyDigest(digest, entries, slackConfig);

      if (result.ok) {
        consola.success(`Posted to ${result.channel} (ts: ${result.ts})`);
      } else {
        consola.error(`Slack post failed: ${result.error}`);
        process.exitCode = 1;
      }
    } catch (err) {
      consola.error("Slack post failed:", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
