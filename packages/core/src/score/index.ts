import type {
  NormalizedItem,
  ScoredItem,
  ProfileConfig,
  SourceConfig,
} from "../types/index.js";
import { computeScore } from "./formula.js";

/**
 * Score all items and return them sorted by total_score descending.
 * The caller decides how many items to take from the result.
 */
export async function score(
  items: NormalizedItem[],
  profile: ProfileConfig,
  sources: SourceConfig[],
): Promise<ScoredItem[]> {
  const scored = items.map((item) =>
    computeScore(item, items, profile, sources),
  );

  scored.sort((a, b) => b.total_score - a.total_score);

  return scored;
}

// Re-export sub-functions for testing
export { scoreRelevance } from "./relevance.js";
export { scoreRecency } from "./recency.js";
export { scoreReinforcement } from "./reinforcement.js";
export { computeScore } from "./formula.js";
