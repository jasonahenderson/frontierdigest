import type { KnownBlock } from "@slack/types";
import type { SourceBundle } from "@frontier-digest/core";

/**
 * Build Slack Block Kit blocks for the Sources drill-down (thread reply).
 */
export function buildSourcesBlocks(bundle: SourceBundle): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Sources for: ${bundle.topic_key}`,
        emoji: false,
      },
    },
  ];

  for (const source of bundle.sources) {
    const badge = source.is_primary ? "Primary" : "Secondary";

    const lines: string[] = [
      `<${source.url}|${source.title}>`,
      `_${source.source_name}_ \u2014 *${badge}*`,
      `> ${source.excerpt}`,
    ];

    if (source.relevance_note) {
      lines.push(`_Relevance: ${source.relevance_note}_`);
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n"),
      },
    });

    blocks.push({ type: "divider" });
  }

  // Remove trailing divider
  if (
    blocks.length > 1 &&
    blocks[blocks.length - 1].type === "divider"
  ) {
    blocks.pop();
  }

  return blocks;
}
