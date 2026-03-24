import { describe, test, expect } from "bun:test";
import { resolveConfig, createModel } from "../../src/synthesize/llm.js";
import {
  DEFAULT_MODELS,
  DEFAULT_API_KEY_ENVS,
} from "../../src/types/llm-config.js";

describe("resolveConfig", () => {
  test("defaults to anthropic when no config provided", () => {
    const resolved = resolveConfig(undefined);
    expect(resolved.provider).toBe("anthropic");
    expect(resolved.model).toBe("claude-sonnet-4-20250514");
  });

  test("defaults to anthropic when empty config provided", () => {
    const resolved = resolveConfig({} as any);
    expect(resolved.provider).toBe("anthropic");
  });

  test("uses specified provider", () => {
    const resolved = resolveConfig({ provider: "openai" });
    expect(resolved.provider).toBe("openai");
    expect(resolved.model).toBe("gpt-4o");
  });

  test("uses specified model over default", () => {
    const resolved = resolveConfig({
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
    });
    expect(resolved.model).toBe("claude-haiku-4-5-20251001");
  });

  test("applies correct default model per provider", () => {
    for (const [provider, expectedModel] of Object.entries(DEFAULT_MODELS)) {
      const resolved = resolveConfig({ provider: provider as any });
      expect(resolved.model).toBe(expectedModel);
    }
  });

  test("preserves custom options", () => {
    const resolved = resolveConfig({
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 2048,
      base_url: "https://custom.com/v1",
    });
    expect(resolved.temperature).toBe(0.7);
    expect(resolved.max_tokens).toBe(2048);
    expect(resolved.base_url).toBe("https://custom.com/v1");
  });

  test("preserves api_key_env when specified", () => {
    const resolved = resolveConfig({
      provider: "anthropic",
      api_key_env: "MY_CUSTOM_KEY",
    });
    expect(resolved.api_key_env).toBe("MY_CUSTOM_KEY");
  });
});

describe("DEFAULT_MODELS", () => {
  test("has a default model for each standard provider", () => {
    expect(DEFAULT_MODELS.anthropic).toBeDefined();
    expect(DEFAULT_MODELS.openai).toBeDefined();
    expect(DEFAULT_MODELS.ollama).toBeDefined();
    expect(DEFAULT_MODELS.google).toBeDefined();
  });

  test("has a default model for openai-compatible", () => {
    expect(DEFAULT_MODELS["openai-compatible"]).toBeDefined();
  });

  test("anthropic default is claude-sonnet-4-20250514", () => {
    expect(DEFAULT_MODELS.anthropic).toBe("claude-sonnet-4-20250514");
  });

  test("openai default is gpt-4o", () => {
    expect(DEFAULT_MODELS.openai).toBe("gpt-4o");
  });

  test("ollama default is llama3.1", () => {
    expect(DEFAULT_MODELS.ollama).toBe("llama3.1");
  });

  test("google default is gemini-2.0-flash", () => {
    expect(DEFAULT_MODELS.google).toBe("gemini-2.0-flash");
  });
});

describe("DEFAULT_API_KEY_ENVS", () => {
  test("has correct env var for anthropic", () => {
    expect(DEFAULT_API_KEY_ENVS.anthropic).toBe("ANTHROPIC_API_KEY");
  });

  test("has correct env var for openai", () => {
    expect(DEFAULT_API_KEY_ENVS.openai).toBe("OPENAI_API_KEY");
  });

  test("has correct env var for google", () => {
    expect(DEFAULT_API_KEY_ENVS.google).toBe("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  test("does not have env var for ollama", () => {
    expect(DEFAULT_API_KEY_ENVS.ollama).toBeUndefined();
  });

  test("has env var for openai-compatible", () => {
    expect(DEFAULT_API_KEY_ENVS["openai-compatible"]).toBe("OPENAI_API_KEY");
  });
});

describe("createModel", () => {
  test("creates a model for anthropic provider", () => {
    const model = createModel({ provider: "anthropic" });
    expect(model).toBeDefined();
  });

  test("creates a model for openai provider", () => {
    const model = createModel({ provider: "openai" });
    expect(model).toBeDefined();
  });

  test("creates a model for ollama provider", () => {
    const model = createModel({ provider: "ollama" });
    expect(model).toBeDefined();
  });

  test("creates a model for google provider", () => {
    const model = createModel({ provider: "google" });
    expect(model).toBeDefined();
  });

  test("throws for openai-compatible without base_url", () => {
    expect(() => createModel({ provider: "openai-compatible" })).toThrow(
      "base_url",
    );
  });

  test("creates a model for openai-compatible with base_url", () => {
    const model = createModel({
      provider: "openai-compatible",
      base_url: "http://localhost:8080/v1",
    });
    expect(model).toBeDefined();
  });

  test("defaults to anthropic when no config provided", () => {
    const model = createModel(undefined);
    expect(model).toBeDefined();
  });

  test("uses custom model name", () => {
    const model = createModel({ provider: "openai", model: "gpt-4o-mini" });
    expect(model).toBeDefined();
  });
});
