import type { App } from "@slack/bolt";
import type { Store } from "@frontier-digest/core";
import { buildExpandBlocks } from "./blocks/expand-reply.js";
import { buildSourcesBlocks } from "./blocks/sources-reply.js";
import {
  buildCompareBlocks,
  type ComparisonData,
} from "./blocks/compare-reply.js";

/**
 * Validate that an action ID contains only safe characters.
 * Action IDs should be alphanumeric with hyphens and underscores.
 */
function validateActionId(raw: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(raw)) {
    throw new Error(`Invalid action ID: ${raw}`);
  }
  return raw;
}

/**
 * Register Bolt action handlers for the three drill-down buttons:
 * expand, sources, and compare.
 */
export function registerInteractions(app: App, store: Store): void {
  // Expand handler — matches action_ids like "expand:<entry-id>"
  app.action(/^expand:/, async ({ action, ack, respond }) => {
    await ack();

    if (!("action_id" in action)) return;

    const entryId = validateActionId(action.action_id.replace(/^expand:/, ""));

    try {
      const pack = await store.getTopicPack(entryId);

      if (!pack) {
        await respond({ text: "Data not available for this topic.", replace_original: false });
        return;
      }

      await respond({
        blocks: buildExpandBlocks(pack),
        text: `Expand: ${pack.title}`,
        replace_original: false,
      });
    } catch {
      await respond({ text: "Data not available for this topic.", replace_original: false });
    }
  });

  // Sources handler — matches action_ids like "sources:<entry-id>"
  app.action(/^sources:/, async ({ action, ack, respond }) => {
    await ack();

    if (!("action_id" in action)) return;

    const entryId = validateActionId(action.action_id.replace(/^sources:/, ""));

    try {
      const pack = await store.getTopicPack(entryId);
      const bundleRef = pack?.source_bundle_ref ?? entryId;
      const bundle = await store.getSourceBundle(bundleRef);

      if (!bundle) {
        await respond({ text: "Data not available for this topic.", replace_original: false });
        return;
      }

      await respond({
        blocks: buildSourcesBlocks(bundle),
        text: `Sources for: ${bundle.topic_key}`,
        replace_original: false,
      });
    } catch {
      await respond({ text: "Data not available for this topic.", replace_original: false });
    }
  });

  // Compare handler — matches action_ids like "compare:<entry-id>"
  app.action(/^compare:/, async ({ action, ack, respond }) => {
    await ack();

    if (!("action_id" in action)) return;

    const entryId = validateActionId(action.action_id.replace(/^compare:/, ""));

    try {
      const history = await store.getTopicHistory(entryId);

      if (history.length < 2) {
        await respond({ text: "No previous week data available for comparison.", replace_original: false });
        return;
      }

      const previous = history[history.length - 2];
      const current = history[history.length - 1];

      const comparisonData: ComparisonData = {
        previous_framing: previous.expanded_summary,
        current_framing: current.expanded_summary,
        detected_shifts: current.what_is_new,
        trend_interpretation: current.uncertainties.length > 0
          ? current.uncertainties.join("; ")
          : "No significant trend shifts detected.",
      };

      await respond({
        blocks: buildCompareBlocks(comparisonData),
        text: `Comparison for: ${current.title}`,
        replace_original: false,
      });
    } catch {
      await respond({ text: "Data not available for this topic.", replace_original: false });
    }
  });
}
