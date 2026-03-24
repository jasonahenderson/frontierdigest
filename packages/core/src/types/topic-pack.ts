import { z } from "zod";

export const TopicPackSchema = z.object({
  id: z.string(),
  topic_key: z.string(),
  title: z.string(),
  expanded_summary: z.string(),
  why_included: z.array(z.string()),
  what_is_new: z.array(z.string()),
  uncertainties: z.array(z.string()),
  source_bundle_ref: z.string(),
  history_ref: z.string().optional(),
  related_topics: z.array(z.string()),
});

export type TopicPack = z.infer<typeof TopicPackSchema>;
