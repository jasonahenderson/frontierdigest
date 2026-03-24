import type { KnownBlock } from "@slack/types";
import type { WeeklyDigest, DigestEntry } from "@frontier-digest/core";
import { escapeSlackMrkdwn } from "@frontier-digest/core";
import { formatDate, pluralize, truncate } from "../formatter.js";

/**
 * Build Slack Block Kit blocks for the weekly digest post.
 */
export function buildDigestBlocks(
  digest: WeeklyDigest,
  entries: DigestEntry[],
  digestName?: string,
): KnownBlock[] {
  const dateLabel = formatDate(digest.generated_at);

  const blocks: KnownBlock[] = [
    // Title
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${digestName ?? "Weekly Digest"} \u2014 ${dateLabel}`,
        emoji: false,
      },
    },

    // Coverage stats
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Coverage:* ${digest.raw_item_count} items \u2192 ${digest.canonical_item_count} canonical stories \u2192 ${digest.top_item_count} priority developments`,
          `*Change vs last week:* ${digest.new_theme_count} new ${pluralize(digest.new_theme_count, "theme")}, ${digest.accelerating_count} accelerating, ${digest.cooling_count} cooling`,
        ].join("\n"),
      },
    },

    { type: "divider" },
  ];

  // One section per entry
  entries.forEach((entry, index) => {
    const entryId = entry.id;
    const rank = index + 1;

    const noveltyLabel =
      entry.novelty_label.charAt(0).toUpperCase() +
      entry.novelty_label.slice(1);
    const confidenceLabel =
      entry.confidence_label.charAt(0).toUpperCase() +
      entry.confidence_label.slice(1);

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${rank}. ${escapeSlackMrkdwn(entry.title)}*`,
          escapeSlackMrkdwn(truncate(entry.summary, 300)),
          `Sources: ${entry.source_count} | Primary: ${entry.primary_source_count} | Novelty: ${noveltyLabel} | Confidence: ${confidenceLabel}`,
        ].join("\n"),
      },
    });

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Expand", emoji: false },
          action_id: `expand:${entryId}`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Sources", emoji: false },
          action_id: `sources:${entryId}`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Compare", emoji: false },
          action_id: `compare:${entryId}`,
        },
      ],
    });

    // Divider between entries (but not after the last one)
    if (index < entries.length - 1) {
      blocks.push({ type: "divider" });
    }
  });

  return blocks;
}
