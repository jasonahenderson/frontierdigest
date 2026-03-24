import { z } from "zod";
import { NormalizedItemSchema } from "./normalized-item.js";

export const DedupeClusterSchema = z.object({
  canonical_id: z.string(),
  member_ids: z.array(z.string()),
  match_type: z.enum([
    "url",
    "title_similarity",
    "content_fingerprint",
    "combined",
  ]),
  similarity_score: z.number().min(0).max(1),
  merge_rationale: z.string(),
});

export type DedupeCluster = z.infer<typeof DedupeClusterSchema>;

export const DedupeResultSchema = z.object({
  canonical_items: z.array(NormalizedItemSchema),
  clusters: z.array(DedupeClusterSchema),
  total_input: z.number().int(),
  total_canonical: z.number().int(),
});

export type DedupeResult = z.infer<typeof DedupeResultSchema>;
