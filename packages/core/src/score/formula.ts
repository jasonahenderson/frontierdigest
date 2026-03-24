import type {
  NormalizedItem,
  ScoredItem,
  ScoreBreakdown,
  ProfileConfig,
  SourceConfig,
} from "../types/index.js";
import { scoreRelevance } from "./relevance.js";
import { scoreRecency } from "./recency.js";
import { scoreReinforcement } from "./reinforcement.js";

/**
 * Compute the composite score for a single item.
 *
 * total_score =
 *   (relevance_weight * relevance) +
 *   (source_weight * source_quality) +
 *   (recency_weight * recency) +
 *   (reinforcement_weight * reinforcement) +
 *   primary_source_bonus (if item is from a primary source)
 */
export function computeScore(
  item: NormalizedItem,
  allItems: NormalizedItem[],
  profile: ProfileConfig,
  sourceConfigs: SourceConfig[],
): ScoredItem {
  const { ranking, interests, window } = profile;

  // Relevance score
  const relevance = scoreRelevance(
    item,
    interests.include,
    interests.exclude,
  );

  // Source quality from configured weight (default 1.0 if source not found)
  const sourceConfig = sourceConfigs.find((s) => s.id === item.source_id);
  const sourceQuality = sourceConfig?.weight ?? 1.0;

  // Recency score
  const windowEnd = new Date().toISOString();
  const recency = scoreRecency(
    item.published_at,
    windowEnd,
    window.weekly_lookback_days,
  );

  // Reinforcement score
  const reinforcement = scoreReinforcement(item, allItems);

  // Primary source bonus: sources with weight >= 0.8 are considered primary
  const isPrimary = sourceQuality >= 0.8;
  const primarySourceBonus = isPrimary ? ranking.primary_source_bonus : 0;

  const scores: ScoreBreakdown = {
    relevance,
    source_quality: sourceQuality,
    recency,
    reinforcement,
    primary_source_bonus: primarySourceBonus,
  };

  const totalScore =
    ranking.relevance_weight * relevance +
    ranking.source_weight * sourceQuality +
    ranking.recency_weight * recency +
    ranking.reinforcement_weight * reinforcement +
    primarySourceBonus;

  return {
    item,
    scores,
    total_score: Math.round(totalScore * 1000) / 1000,
  };
}
