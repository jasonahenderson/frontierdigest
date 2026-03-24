import { z } from "zod";

export const NormalizedItemSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  source_name: z.string(),
  source_type: z.enum(["rss", "api", "scrape"]),
  title: z.string(),
  url: z.string().url(),
  canonical_url: z.string().url(),
  published_at: z.string().datetime(),
  fetched_at: z.string().datetime(),
  author: z.string().optional(),
  tags: z.array(z.string()),
  text: z.string(),
  excerpt: z.string(),
  content_hash: z.string(),
  language: z.string().default("en"),
});

export type NormalizedItem = z.infer<typeof NormalizedItemSchema>;
