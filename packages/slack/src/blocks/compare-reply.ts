import type { KnownBlock } from "@slack/types";

export interface ComparisonData {
  previous_framing: string;
  current_framing: string;
  detected_shifts: string[];
  trend_interpretation: string;
}

/**
 * Build Slack Block Kit blocks for the Compare drill-down (thread reply).
 */
export function buildCompareBlocks(data: ComparisonData): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Week-over-Week Comparison",
        emoji: false,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Previous framing:*\n${data.previous_framing}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Current framing:*\n${data.current_framing}`,
      },
    },
  ];

  if (data.detected_shifts.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Detected shifts:*\n" +
          data.detected_shifts.map((s) => `\u2022 ${s}`).join("\n"),
      },
    });
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Trend interpretation:*\n${data.trend_interpretation}`,
    },
  });

  return blocks;
}
