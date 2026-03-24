import { WebClient } from "@slack/web-api";
import type {
  WeeklyDigest,
  DigestEntry,
  SlackConfig,
} from "@frontier-digest/core";
import { buildDigestBlocks } from "./blocks/digest-post.js";

export interface SlackPostResult {
  ok: boolean;
  channel: string;
  ts: string;
  error?: string;
}

/**
 * Post the weekly digest to the configured Slack channel.
 * Returns the message timestamp so thread replies can reference it.
 */
export async function postWeeklyDigest(
  digest: WeeklyDigest,
  entries: DigestEntry[],
  config: SlackConfig,
  digestName?: string,
): Promise<SlackPostResult> {
  const client = new WebClient(config.bot_token);
  const blocks = buildDigestBlocks(digest, entries, digestName);

  try {
    const result = await client.chat.postMessage({
      channel: config.channel,
      blocks,
      text: `${digestName ?? "Weekly Digest"} — ${digest.generated_at}`,
    });

    return {
      ok: Boolean(result.ok),
      channel: (result.channel as string) ?? config.channel,
      ts: (result.ts as string) ?? "",
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error posting to Slack";
    return {
      ok: false,
      channel: config.channel,
      ts: "",
      error: message,
    };
  }
}
