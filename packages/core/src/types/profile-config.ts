import { z } from "zod";

export const ProfileConfigSchema = z.object({
  profile: z.string(),
  window: z.object({
    weekly_lookback_days: z.number().int().default(7),
  }),
  interests: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()).default([]),
  }),
  ranking: z.object({
    max_digest_items: z.number().int().default(8),
    primary_source_bonus: z.number().default(0.2),
    recency_weight: z.number().default(0.2),
    relevance_weight: z.number().default(0.4),
    source_weight: z.number().default(0.2),
    reinforcement_weight: z.number().default(0.2),
  }),
  outputs: z.object({
    root_dir: z.string().default("./data"),
    write_markdown: z.boolean().default(true),
    write_json: z.boolean().default(true),
  }),
  slack: z.object({
    enabled: z.boolean().default(true),
    channel: z.string(),
    post_threads: z.boolean().default(true),
  }),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
