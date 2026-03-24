import type { ScoredItem, TopicCluster, ProfileConfig } from "../types/index.js";
import { clusterByOverlap } from "./overlap.js";
import { fallbackLabel, generateTopicKey } from "./label.js";

export { clusterByOverlap } from "./overlap.js";
export type { ClusterCandidate } from "./overlap.js";
export { fallbackLabel, generateTopicKey } from "./label.js";

/**
 * Main clustering entrypoint.
 *
 * Groups scored items into topic clusters, labels them, and returns
 * the top N clusters based on the profile's max_digest_items setting.
 */
export async function cluster(
  items: ScoredItem[],
  profile: ProfileConfig,
): Promise<TopicCluster[]> {
  if (items.length === 0) return [];

  // Cluster items by tag overlap and title similarity
  const candidates = clusterByOverlap(items);

  // Label each cluster and build TopicCluster objects
  const clusters: TopicCluster[] = candidates.map((candidate, idx) => {
    const { label, tags } = fallbackLabel(candidate.items);
    const topicKey = generateTopicKey(label);

    // Count distinct primary sources
    const sourceIds = new Set(candidate.items.map((si) => si.item.source_id));

    return {
      id: `cluster-${topicKey}-${idx}`,
      label,
      item_ids: candidate.items.map((si) => si.item.id),
      items: candidate.items,
      aggregate_score: candidate.aggregate_score,
      tags,
      primary_source_count: sourceIds.size,
    };
  });

  // Already sorted by aggregate_score descending from clusterByOverlap
  // Take the top N clusters based on profile config
  const maxItems = profile.ranking.max_digest_items;
  return clusters.slice(0, maxItems);
}
