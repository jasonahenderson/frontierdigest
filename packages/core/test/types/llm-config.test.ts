import { describe, test, expect } from "bun:test";
import { LLMConfigSchema, LLMProviderEnum } from "../../src/types/index.js";

describe("LLMConfigSchema", () => {
  test("validates minimal config with just provider", () => {
    const result = LLMConfigSchema.safeParse({ provider: "anthropic" });
    expect(result.success).toBe(true);
  });

  test("applies anthropic as default provider", () => {
    const result = LLMConfigSchema.parse({});
    expect(result.provider).toBe("anthropic");
  });

  test("validates full config with all fields", () => {
    const result = LLMConfigSchema.safeParse({
      provider: "openai",
      model: "gpt-4o",
      api_key_env: "MY_OPENAI_KEY",
      base_url: "https://custom.api.com/v1",
      temperature: 0.5,
      max_tokens: 8192,
    });
    expect(result.success).toBe(true);
  });

  test("rejects unknown provider", () => {
    const result = LLMConfigSchema.safeParse({ provider: "unknown-llm" });
    expect(result.success).toBe(false);
  });

  test("validates all known providers", () => {
    for (const provider of [
      "anthropic",
      "openai",
      "ollama",
      "google",
      "openai-compatible",
    ]) {
      const result = LLMConfigSchema.safeParse({ provider });
      expect(result.success).toBe(true);
    }
  });

  test("rejects temperature below 0", () => {
    const result = LLMConfigSchema.safeParse({
      provider: "anthropic",
      temperature: -0.1,
    });
    expect(result.success).toBe(false);
  });

  test("rejects temperature above 2", () => {
    const result = LLMConfigSchema.safeParse({
      provider: "anthropic",
      temperature: 2.1,
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative max_tokens", () => {
    const result = LLMConfigSchema.safeParse({
      provider: "anthropic",
      max_tokens: -1,
    });
    expect(result.success).toBe(false);
  });

  test("rejects zero max_tokens", () => {
    const result = LLMConfigSchema.safeParse({
      provider: "anthropic",
      max_tokens: 0,
    });
    expect(result.success).toBe(false);
  });

  test("allows optional fields to be omitted", () => {
    const result = LLMConfigSchema.parse({ provider: "ollama" });
    expect(result.model).toBeUndefined();
    expect(result.api_key_env).toBeUndefined();
    expect(result.base_url).toBeUndefined();
    expect(result.temperature).toBeUndefined();
    expect(result.max_tokens).toBeUndefined();
  });

  test("accepts boundary temperature values", () => {
    expect(
      LLMConfigSchema.safeParse({ provider: "anthropic", temperature: 0 })
        .success,
    ).toBe(true);
    expect(
      LLMConfigSchema.safeParse({ provider: "anthropic", temperature: 2 })
        .success,
    ).toBe(true);
  });

  test("accepts positive integer max_tokens", () => {
    expect(
      LLMConfigSchema.safeParse({ provider: "anthropic", max_tokens: 1 })
        .success,
    ).toBe(true);
    expect(
      LLMConfigSchema.safeParse({ provider: "anthropic", max_tokens: 100000 })
        .success,
    ).toBe(true);
  });

  test("rejects non-integer max_tokens", () => {
    const result = LLMConfigSchema.safeParse({
      provider: "anthropic",
      max_tokens: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("LLMProviderEnum", () => {
  test("has exactly 5 options", () => {
    expect(LLMProviderEnum.options).toHaveLength(5);
  });

  test("includes all expected providers", () => {
    const options = LLMProviderEnum.options;
    expect(options).toContain("anthropic");
    expect(options).toContain("openai");
    expect(options).toContain("ollama");
    expect(options).toContain("google");
    expect(options).toContain("openai-compatible");
  });
});
