import { z } from "zod";
import { NormalizedItemSchema } from "./normalized-item.js";

export const ScoreBreakdownSchema = z.object({
  relevance: z.number(),
  source_quality: z.number(),
  recency: z.number(),
  reinforcement: z.number(),
  primary_source_bonus: z.number(),
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const ScoredItemSchema = z.object({
  item: NormalizedItemSchema,
  scores: ScoreBreakdownSchema,
  total_score: z.number(),
});

export type ScoredItem = z.infer<typeof ScoredItemSchema>;
