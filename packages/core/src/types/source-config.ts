import { z } from "zod";

export const SourceConfigSchema = z.object({
  id: z.string(),
  type: z.enum(["rss", "api", "scrape"]),
  name: z.string(),
  url: z.string().url(),
  weight: z.number().min(0).max(1).default(1.0),
  tags: z.array(z.string()).default([]),
  auth: z
    .object({
      token: z.string().optional(),
      header: z.string().optional(),
    })
    .optional(),
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;

export const SourcesConfigSchema = z.object({
  sources: z.array(SourceConfigSchema),
});

export type SourcesConfig = z.infer<typeof SourcesConfigSchema>;
