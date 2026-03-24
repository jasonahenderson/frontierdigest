import type {
  NormalizedItem,
  DedupeResult,
  DedupeCluster,
} from "../types/index.js";
import { titleSimilarity } from "./similarity.js";
import { contentFingerprint, fingerprintSimilarity } from "./fingerprint.js";
import { urlsMatch } from "./url-match.js";

export { titleSimilarity, generateTrigrams, diceCoefficient } from "./similarity.js";
export { contentFingerprint, fingerprintSimilarity } from "./fingerprint.js";
export { urlsMatch } from "./url-match.js";

export interface DedupeOptions {
  titleSimilarityThreshold?: number;
  fingerprintSimilarityThreshold?: number;
  preferHigherWeight?: boolean;
}

const DEFAULT_OPTIONS: Required<DedupeOptions> = {
  titleSimilarityThreshold: 0.7,
  fingerprintSimilarityThreshold: 0.6,
  preferHigherWeight: true,
};

/**
 * Source type weights for picking the representative item.
 * Higher weight = preferred source.
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  api: 3,
  rss: 2,
  scrape: 1,
};

/**
 * Pick the representative item from a group.
 * Prefer higher source weight, then earlier publication date.
 */
function pickRepresentative(items: NormalizedItem[]): NormalizedItem {
  return items.sort((a, b) => {
    const weightA = SOURCE_WEIGHTS[a.source_type] ?? 0;
    const weightB = SOURCE_WEIGHTS[b.source_type] ?? 0;
    if (weightB !== weightA) return weightB - weightA;
    return new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
  })[0];
}

/**
 * Deduplicate normalized items by URL, title similarity, and content fingerprint.
 */
export async function dedupe(
  items: NormalizedItem[],
  options?: DedupeOptions,
): Promise<DedupeResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const totalInput = items.length;

  // Track which items have been assigned to a cluster
  const clustered = new Set<string>();
  const clusters: DedupeCluster[] = [];

  // Map item id to item for quick lookup
  const itemMap = new Map<string, NormalizedItem>();
  for (const item of items) {
    itemMap.set(item.id, item);
  }

  // Step 1: Group by canonical URL
  const urlGroups = new Map<string, NormalizedItem[]>();
  for (const item of items) {
    const key = item.canonical_url;
    const group = urlGroups.get(key);
    if (group) {
      group.push(item);
    } else {
      urlGroups.set(key, [item]);
    }
  }

  for (const [, group] of urlGroups) {
    if (group.length > 1) {
      const representative = pickRepresentative(group);
      const memberIds = group.map((i) => i.id);
      for (const id of memberIds) {
        clustered.add(id);
      }
      clusters.push({
        canonical_id: representative.id,
        member_ids: memberIds,
        match_type: "url",
        similarity_score: 1.0,
        merge_rationale: `Exact canonical URL match: ${group[0].canonical_url}`,
      });
    }
  }

  // Step 2: Title similarity on unclustered items
  const unclustered1 = items.filter((i) => !clustered.has(i.id));
  const titleMatched = new Set<string>();

  for (let i = 0; i < unclustered1.length; i++) {
    if (titleMatched.has(unclustered1[i].id)) continue;

    const group: NormalizedItem[] = [unclustered1[i]];

    for (let j = i + 1; j < unclustered1.length; j++) {
      if (titleMatched.has(unclustered1[j].id)) continue;

      const score = titleSimilarity(unclustered1[i].title, unclustered1[j].title);
      if (score >= opts.titleSimilarityThreshold) {
        group.push(unclustered1[j]);
        titleMatched.add(unclustered1[j].id);
      }
    }

    if (group.length > 1) {
      titleMatched.add(unclustered1[i].id);
      const representative = pickRepresentative(group);
      const memberIds = group.map((item) => item.id);
      for (const id of memberIds) {
        clustered.add(id);
      }

      // Compute average similarity to first item
      let totalScore = 0;
      for (let k = 1; k < group.length; k++) {
        totalScore += titleSimilarity(group[0].title, group[k].title);
      }
      const avgScore = totalScore / (group.length - 1);

      clusters.push({
        canonical_id: representative.id,
        member_ids: memberIds,
        match_type: "title_similarity",
        similarity_score: Math.round(avgScore * 1000) / 1000,
        merge_rationale: `Title similarity above threshold (${opts.titleSimilarityThreshold})`,
      });
    }
  }

  // Step 3: Content fingerprint similarity on remaining unclustered items
  const unclustered2 = items.filter((i) => !clustered.has(i.id));

  // Pre-compute fingerprints
  const fingerprints = new Map<string, string>();
  for (const item of unclustered2) {
    fingerprints.set(item.id, contentFingerprint(item.text));
  }

  const fpMatched = new Set<string>();

  for (let i = 0; i < unclustered2.length; i++) {
    if (fpMatched.has(unclustered2[i].id)) continue;

    const group: NormalizedItem[] = [unclustered2[i]];
    const fpA = fingerprints.get(unclustered2[i].id)!;

    for (let j = i + 1; j < unclustered2.length; j++) {
      if (fpMatched.has(unclustered2[j].id)) continue;

      const fpB = fingerprints.get(unclustered2[j].id)!;
      const score = fingerprintSimilarity(fpA, fpB);
      if (score >= opts.fingerprintSimilarityThreshold) {
        group.push(unclustered2[j]);
        fpMatched.add(unclustered2[j].id);
      }
    }

    if (group.length > 1) {
      fpMatched.add(unclustered2[i].id);
      const representative = pickRepresentative(group);
      const memberIds = group.map((item) => item.id);
      for (const id of memberIds) {
        clustered.add(id);
      }

      // Compute average fingerprint similarity
      let totalScore = 0;
      for (let k = 1; k < group.length; k++) {
        totalScore += fingerprintSimilarity(fpA, fingerprints.get(group[k].id)!);
      }
      const avgScore = totalScore / (group.length - 1);

      clusters.push({
        canonical_id: representative.id,
        member_ids: memberIds,
        match_type: "content_fingerprint",
        similarity_score: Math.round(avgScore * 1000) / 1000,
        merge_rationale: `Content fingerprint similarity above threshold (${opts.fingerprintSimilarityThreshold})`,
      });
    }
  }

  // Build final canonical items list:
  // - For clusters, include the representative
  // - For unclustered items, include as-is
  const canonicalIds = new Set<string>();
  for (const cluster of clusters) {
    canonicalIds.add(cluster.canonical_id);
  }
  // Add unclustered items
  for (const item of items) {
    if (!clustered.has(item.id)) {
      canonicalIds.add(item.id);
    }
  }

  const canonicalItems = Array.from(canonicalIds)
    .map((id) => itemMap.get(id)!)
    .filter(Boolean);

  return {
    canonical_items: canonicalItems,
    clusters,
    total_input: totalInput,
    total_canonical: canonicalItems.length,
  };
}
