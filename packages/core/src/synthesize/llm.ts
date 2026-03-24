import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOllama } from "ollama-ai-provider";
import { consola } from "consola";
import type { LLMConfig } from "../types/index.js";
import { DEFAULT_MODELS, DEFAULT_API_KEY_ENVS } from "../types/llm-config.js";

/**
 * Resolve a complete LLM config with defaults applied.
 */
export function resolveConfig(config?: LLMConfig): Required<Pick<LLMConfig, "provider" | "model">> & LLMConfig {
  const provider = config?.provider ?? "anthropic";
  const model = config?.model ?? DEFAULT_MODELS[provider] ?? "claude-sonnet-4-20250514";
  return { ...config, provider, model };
}

/**
 * Create an AI SDK model instance from config.
 */
export function createModel(config?: LLMConfig) {
  const resolved = resolveConfig(config);
  const apiKeyEnv = resolved.api_key_env ?? DEFAULT_API_KEY_ENVS[resolved.provider];
  const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : undefined;

  switch (resolved.provider) {
    case "anthropic": {
      const provider = createAnthropic({ apiKey });
      return provider(resolved.model);
    }
    case "openai": {
      const provider = createOpenAI({ apiKey });
      return provider(resolved.model);
    }
    case "google": {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(resolved.model);
    }
    case "ollama": {
      const provider = createOllama({ baseURL: resolved.base_url });
      return provider(resolved.model);
    }
    case "openai-compatible": {
      if (!resolved.base_url) {
        throw new Error("openai-compatible provider requires base_url");
      }
      const provider = createOpenAI({
        apiKey: apiKey ?? "",
        baseURL: resolved.base_url,
      });
      return provider(resolved.model);
    }
    default:
      throw new Error(`Unknown LLM provider: ${resolved.provider}`);
  }
}

/**
 * Generate text from an LLM. This is the single entry point for all LLM calls.
 * The signature is backward-compatible — config is optional.
 */
export async function llmGenerate(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
    llmConfig?: LLMConfig;
  },
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 4096;
  const temperature = options?.temperature ?? 0.3;
  const model = createModel(options?.llmConfig);
  const resolved = resolveConfig(options?.llmConfig);

  consola.debug(`LLM: ${resolved.provider}/${resolved.model}`);

  try {
    const result = await generateText({
      model: model as Parameters<typeof generateText>[0]["model"],
      maxOutputTokens: maxTokens,
      temperature,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.text;
  } catch (error) {
    consola.error(`LLM generation failed (${resolved.provider}/${resolved.model}):`, error);
    throw error;
  }
}
