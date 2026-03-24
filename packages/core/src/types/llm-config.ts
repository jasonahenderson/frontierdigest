import { z } from "zod";

export const LLMProviderEnum = z.enum([
  "anthropic",
  "openai",
  "ollama",
  "google",
  "openai-compatible",
]);

export type LLMProviderType = z.infer<typeof LLMProviderEnum>;

export const LLMConfigSchema = z.object({
  provider: LLMProviderEnum.default("anthropic"),
  model: z.string().optional(),  // defaults per provider if not specified
  api_key_env: z.string().optional(),  // env var name, auto-detected per provider
  base_url: z.string().optional(),  // for ollama or custom endpoints
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/** Default models per provider */
export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  ollama: "llama3.1",
  google: "gemini-2.0-flash",
  "openai-compatible": "gpt-4o",
};

/** Default API key env vars per provider */
export const DEFAULT_API_KEY_ENVS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  "openai-compatible": "OPENAI_API_KEY",
  // ollama has no API key
};
