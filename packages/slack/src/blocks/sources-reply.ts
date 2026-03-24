import type { KnownBlock } from "@slack/types";
import type { SourceBundle } from "@frontier-digest/core";
import { escapeSlackMrkdwn } from "@frontier-digest/core";

/**
 * Validate that a URL starts with http:// or https://.
 * Returns the URL if valid, or a safe placeholder if not.
 */
function validateUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return "about:blank";
}

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
      `<${validateUrl(source.url)}|${escapeSlackMrkdwn(source.title)}>`,
      `_${source.source_name}_ \u2014 *${badge}*`,
      `> ${escapeSlackMrkdwn(source.excerpt)}`,
    ];

    if (source.relevance_note) {
      lines.push(`_Relevance: ${escapeSlackMrkdwn(source.relevance_note)}_`);
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
