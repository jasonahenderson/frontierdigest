import type { ScoredItem } from "../types/index.js";
import { titleSimilarity } from "../dedupe/similarity.js";

export interface ClusterCandidate {
  items: ScoredItem[];
  shared_tags: string[];
  aggregate_score: number;
}

/**
 * Cluster scored items by tag overlap and title similarity.
 *
 * Algorithm:
 * 1. Build a tag co-occurrence matrix
 * 2. Group items that share >= minSharedTags tags
 * 3. Within each group, confirm relatedness via title similarity
 * 4. Merge overlapping groups (if an item appears in multiple groups)
 * 5. Attach ungrouped high-scoring items to existing clusters via title similarity
 * 6. Sort clusters by aggregate score descending
 * 7. Ungrouped items become singleton clusters
 */
export function clusterByOverlap(
  items: ScoredItem[],
  minSharedTags: number = 2,
  titleSimilarityThreshold: number = 0.5,
): ClusterCandidate[] {
  if (items.length === 0) return [];

  // Step 1: Build tag co-occurrence matrix (pairs of item indices that share tags)
  const tagToItems = new Map<string, number[]>();
  for (let i = 0; i < items.length; i++) {
    for (const tag of items[i].item.tags) {
      const normalized = tag.toLowerCase();
      if (!tagToItems.has(normalized)) {
        tagToItems.set(normalized, []);
      }
      tagToItems.get(normalized)!.push(i);
    }
  }

  // Step 2: Count shared tags between each pair of items
  const sharedTagCount = new Map<string, number>();
  const sharedTagNames = new Map<string, Set<string>>();

  const pairKey = (i: number, j: number): string =>
    i < j ? `${i}:${j}` : `${j}:${i}`;

  for (const [tag, indices] of tagToItems) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const key = pairKey(indices[a], indices[b]);
        sharedTagCount.set(key, (sharedTagCount.get(key) ?? 0) + 1);
        if (!sharedTagNames.has(key)) {
          sharedTagNames.set(key, new Set());
        }
        sharedTagNames.get(key)!.add(tag);
      }
    }
  }

  // Step 2 cont: Group items that share >= minSharedTags
  // Use Union-Find for efficient merging
  const parent = items.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Step 3: Merge pairs with enough shared tags AND title similarity confirmation
  for (const [key, count] of sharedTagCount) {
    if (count >= minSharedTags) {
      const [iStr, jStr] = key.split(":");
      const i = Number(iStr);
      const j = Number(jStr);
      const sim = titleSimilarity(items[i].item.title, items[j].item.title);
      // Accept if title similarity meets threshold OR tag overlap is very strong
      if (sim >= titleSimilarityThreshold || count >= minSharedTags + 1) {
        union(i, j);
      }
    }
  }

  // Step 4: Collect groups (overlapping groups are already merged via union-find)
  const groups = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(i);
  }

  // Split into multi-item clusters and singletons
  const multiClusters: number[][] = [];
  const singletons: number[] = [];
  for (const members of groups.values()) {
    if (members.length > 1) {
      multiClusters.push(members);
    } else {
      singletons.push(members[0]);
    }
  }

  // Step 5: For ungrouped high-scoring items, try to attach to existing clusters
  const remainingSingletons: number[] = [];
  for (const idx of singletons) {
    let bestClusterIdx = -1;
    let bestSim = 0;

    for (let c = 0; c < multiClusters.length; c++) {
      for (const memberIdx of multiClusters[c]) {
        const sim = titleSimilarity(
          items[idx].item.title,
          items[memberIdx].item.title,
        );
        if (sim > bestSim) {
          bestSim = sim;
          bestClusterIdx = c;
        }
      }
    }

    if (bestClusterIdx >= 0 && bestSim >= titleSimilarityThreshold) {
      multiClusters[bestClusterIdx].push(idx);
    } else {
      remainingSingletons.push(idx);
    }
  }

  // Build ClusterCandidate results
  const candidates: ClusterCandidate[] = [];

  for (const memberIndices of multiClusters) {
    const clusterItems = memberIndices.map((i) => items[i]);

    // Compute shared tags across the cluster
    const tagCounts = new Map<string, number>();
    for (const idx of memberIndices) {
      const seen = new Set<string>();
      for (const tag of items[idx].item.tags) {
        const normalized = tag.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
        }
      }
    }
    // Tags shared by at least 2 members
    const shared = [...tagCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([tag]) => tag)
      .sort();

    const aggregateScore = clusterItems.reduce(
      (sum, si) => sum + si.total_score,
      0,
    );

    candidates.push({
      items: clusterItems,
      shared_tags: shared,
      aggregate_score: aggregateScore,
    });
  }

  // Step 7: Singletons become their own clusters
  for (const idx of remainingSingletons) {
    const si = items[idx];
    candidates.push({
      items: [si],
      shared_tags: [...si.item.tags].map((t) => t.toLowerCase()),
      aggregate_score: si.total_score,
    });
  }

  // Step 6: Sort by aggregate score descending
  candidates.sort((a, b) => b.aggregate_score - a.aggregate_score);

  return candidates;
}
