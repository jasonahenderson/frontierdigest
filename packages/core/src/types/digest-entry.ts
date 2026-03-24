import { z } from "zod";

export const DigestEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  why_it_matters: z.string(),
  novelty_label: z.enum(["high", "medium", "low"]),
  confidence_label: z.enum(["high", "medium", "low"]),
  source_count: z.number().int().min(0),
  primary_source_count: z.number().int().min(0),
  source_ids: z.array(z.string()),
  topic_ids: z.array(z.string()),
  comparison_ref: z.string().optional(),
});

export type DigestEntry = z.infer<typeof DigestEntrySchema>;
