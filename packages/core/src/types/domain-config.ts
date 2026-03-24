import { z } from "zod";
import { SourceConfigSchema } from "./source-config.js";
import { LLMConfigSchema } from "./llm-config.js";

export const PromptContextSchema = z.object({
  persona: z
    .string()
    .describe(
      "LLM persona for this domain, e.g. 'You are a quantum computing research analyst...'",
    ),
  focus: z
    .string()
    .describe(
      "Domain focus area for prompts, e.g. 'quantum computing hardware, algorithms, and applications'",
    ),
});

export type PromptContext = z.infer<typeof PromptContextSchema>;

// Domain config wraps profile + sources + prompt context + slack into one file
// The profile field reuses ProfileConfig but without the top-level "profile" name field
// (the domain.id serves that purpose)
export const DomainConfigSchema = z.object({
  domain: z.object({
    id: z
      .string()
      .regex(
        /^[a-z0-9-]+$/,
        "Domain ID must be lowercase alphanumeric with hyphens",
      ),
    name: z.string(),
    description: z.string().optional(),

    prompt_context: PromptContextSchema,

    profile: z.object({
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
      outputs: z
        .object({
          root_dir: z.string().default("./data"),
          write_markdown: z.boolean().default(true),
          write_json: z.boolean().default(true),
        })
        .default({}),
    }),

    sources: z.array(SourceConfigSchema),

    llm: LLMConfigSchema.optional(),

    slack: z.object({
      enabled: z.boolean().default(true),
      channel: z.string(),
      post_threads: z.boolean().default(true),
    }),
  }),
});

export type DomainConfig = z.infer<typeof DomainConfigSchema>;
