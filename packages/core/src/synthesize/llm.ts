import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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
      // Use OpenAI-compatible endpoint with extended timeout for local inference
      const baseURL = resolved.base_url ?? "http://localhost:11434/v1";
      const provider = createOpenAI({
        apiKey: "ollama",
        baseURL,
        fetch: ((input: any, init: any) =>
          globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(600_000) })
        ) as typeof globalThis.fetch,
      });
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
  const resolved = resolveConfig(options?.llmConfig);
  const model = createModel(options?.llmConfig);
  const defaultTokens = resolved.provider === "ollama" ? 4096 : 4096;
  const maxTokens = options?.maxTokens ?? defaultTokens;
  const temperature = options?.temperature ?? 0.3;

  consola.debug(`LLM: ${resolved.provider}/${resolved.model}`);

  // Local models (Ollama) need more time; cloud APIs are faster
  const timeoutMs = resolved.provider === "ollama" ? 600_000 : 120_000;
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const result = await generateText({
      model: model as Parameters<typeof generateText>[0]["model"],
      maxOutputTokens: maxTokens,
      temperature,
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: abortController.signal,
      // Force JSON output for providers that support it
      ...(resolved.provider === "ollama" || resolved.provider === "openai"
        ? { providerOptions: { openai: { response_format: { type: "json_object" } } } }
        : {}),
    });

    clearTimeout(timer);
    return result.text;
  } catch (error) {
    clearTimeout(timer);
    consola.error(`LLM generation failed (${resolved.provider}/${resolved.model}):`, error);
    throw error;
  }
}

/**
 * Extract JSON from an LLM response that may contain markdown fences,
 * preamble text, or other wrapping around the JSON object.
 */
export function extractJson(raw: string): unknown {
  // 1. Strip markdown fences
  let cleaned = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();

  // 2. Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue
  }

  // 3. Find the first { or [ and last } or ] — extract the JSON substring
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let start = -1;
  let end = -1;

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = cleaned.lastIndexOf("}");
  } else if (firstBracket >= 0) {
    start = firstBracket;
    end = cleaned.lastIndexOf("]");
  }

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // continue
    }
  }

  throw new Error("Could not extract JSON from LLM response");
}
