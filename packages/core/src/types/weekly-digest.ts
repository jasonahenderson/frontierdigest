import { z } from "zod";

export const WeeklyDigestSchema = z.object({
  id: z.string(),
  generated_at: z.string().datetime(),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  raw_item_count: z.number().int().min(0),
  canonical_item_count: z.number().int().min(0),
  top_item_count: z.number().int().min(0),
  summary: z.string(),
  entries: z.array(z.string()),
  new_theme_count: z.number().int().min(0),
  accelerating_count: z.number().int().min(0),
  cooling_count: z.number().int().min(0),
  run_ref: z.string(),
});

export type WeeklyDigest = z.infer<typeof WeeklyDigestSchema>;
