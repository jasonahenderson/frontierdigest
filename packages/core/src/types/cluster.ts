import { z } from "zod";
import { ScoredItemSchema } from "./scoring.js";

export const TopicClusterSchema = z.object({
  id: z.string(),
  label: z.string(),
  item_ids: z.array(z.string()),
  items: z.array(ScoredItemSchema),
  aggregate_score: z.number(),
  tags: z.array(z.string()),
  primary_source_count: z.number().int(),
});

export type TopicCluster = z.infer<typeof TopicClusterSchema>;
