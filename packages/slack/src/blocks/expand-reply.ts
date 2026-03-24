import type { KnownBlock } from "@slack/types";
import type { TopicPack } from "@frontier-digest/core";

/**
 * Build Slack Block Kit blocks for the Expand drill-down (thread reply).
 */
export function buildExpandBlocks(pack: TopicPack): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: pack.title,
        emoji: false,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: pack.expanded_summary,
      },
    },
  ];

  // Why included
  if (pack.why_included.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Why included:*\n" +
          pack.why_included.map((item) => `\u2022 ${item}`).join("\n"),
      },
    });
  }

  // What is new
  if (pack.what_is_new.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*What\u2019s new:*\n" +
          pack.what_is_new.map((item) => `\u2022 ${item}`).join("\n"),
      },
    });
  }

  // Uncertainties
  if (pack.uncertainties.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Uncertainties:*\n" +
          pack.uncertainties.map((item) => `\u2022 ${item}`).join("\n"),
      },
    });
  }

  // Related topics
  if (pack.related_topics.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Related topics:* ${pack.related_topics.join(", ")}`,
      },
    });
  }

  return blocks;
}
