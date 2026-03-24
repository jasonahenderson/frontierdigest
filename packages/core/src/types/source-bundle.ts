import { z } from "zod";

export const SourceEvidenceSchema = z.object({
  item_id: z.string(),
  title: z.string(),
  url: z.string(),
  source_name: z.string(),
  is_primary: z.boolean(),
  excerpt: z.string(),
  relevance_note: z.string().optional(),
});

export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;

export const SourceBundleSchema = z.object({
  id: z.string(),
  topic_key: z.string(),
  date: z.string(),
  sources: z.array(SourceEvidenceSchema),
});

export type SourceBundle = z.infer<typeof SourceBundleSchema>;
