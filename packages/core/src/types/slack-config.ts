import { z } from "zod";

export const SlackConfigSchema = z.object({
  bot_token: z.string(),
  signing_secret: z.string(),
  app_token: z.string().optional(),
  channel: z.string(),
  post_threads: z.boolean().default(true),
});

export type SlackConfig = z.infer<typeof SlackConfigSchema>;
