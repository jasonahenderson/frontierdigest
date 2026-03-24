# Multi-Provider LLM Support

## Overview

Frontier Digest uses LLM calls in exactly two places:

1. **Synthesis** — generating digest entries, topic expansions, source analysis, comparisons, and weekly summaries (5 functions in `packages/core/src/synthesize/`)
2. **Init wizard** — generating domain configs from natural-language topic descriptions (`packages/core/src/init/`)

All 6 call sites use the same function: `llmGenerate(system, user, options?) → string`. This makes provider abstraction clean — only `llm.ts` needs to change.

## Problem

The current implementation is hardcoded to Anthropic:

```typescript
// packages/core/src/synthesize/llm.ts
import Anthropic from "@anthropic-ai/sdk";
const response = await getClient().messages.create({
  model: "claude-sonnet-4-20250514",
  // ...
});
```

Users may want to use:
- **OpenAI** (GPT-4o, o3, etc.) — most widely available
- **Ollama** — free local models, no API key needed, privacy
- **Google** (Gemini) — alternative cloud provider
- **Other** — Mistral, Groq, Together, custom endpoints

## Solution: Vercel AI SDK

The [Vercel AI SDK](https://sdk.vercel.ai/) (`ai` package) provides a unified `generateText()` interface across all major providers. Each provider is a small adapter package.

### Why AI SDK over alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **Vercel AI SDK** | Unified API, huge provider support, TS-native, well-maintained, Bun compatible | Adds ~5 small packages |
| Custom interface | Zero deps, full control | Reimplements what AI SDK does; each provider has quirks |
| OpenAI-compatible only | One SDK for many providers | Anthropic isn't OpenAI-compatible; lose native support |

### Provider matrix

| Provider | Package | Auth | Models | Use case |
|----------|---------|------|--------|----------|
| Anthropic | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` | Claude Sonnet, Opus, Haiku | Default, highest quality |
| OpenAI | `@ai-sdk/openai` | `OPENAI_API_KEY` | GPT-4o, o3-mini, o1 | Widely available |
| Ollama | `ollama-ai-provider` | None (local) | Llama 3, Mistral, Qwen | Free, private, offline |
| Google | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini 2.0 Flash/Pro | Alternative cloud |
| OpenAI-compatible | `@ai-sdk/openai` | Varies | Any compatible endpoint | Groq, Together, vLLM, etc. |

## Configuration Schema

### In domain config

```yaml
domain:
  id: ai-frontier
  name: "AI Frontier Digest"

  llm:
    provider: anthropic                    # anthropic | openai | ollama | google | openai-compatible
    model: claude-sonnet-4-20250514  # provider-specific model ID
    # api_key_env: ANTHROPIC_API_KEY       # env var name for API key (auto-detected per provider)
    # base_url: http://localhost:11434/v1  # for ollama or custom endpoints
    # temperature: 0.3                     # override default (0.3)
    # max_tokens: 4096                     # override default (4096)
```

### Defaults per provider

| Provider | Default model | Default API key env | Default base URL |
|----------|--------------|--------------------|----|
| `anthropic` | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` | Anthropic API |
| `openai` | `gpt-4o` | `OPENAI_API_KEY` | OpenAI API |
| `ollama` | `llama3.1` | (none) | `http://localhost:11434` |
| `google` | `gemini-2.0-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` | Google API |
| `openai-compatible` | (required) | `OPENAI_API_KEY` | (required) |

If no `llm` section is provided, defaults to `anthropic` with `claude-sonnet-4-20250514`.

## Implementation Plan

### Files changed

| File | Change |
|------|--------|
| `packages/core/src/types/llm-config.ts` | **New** — Zod schema for LLM config |
| `packages/core/src/types/domain-config.ts` | Add optional `llm` field |
| `packages/core/src/types/index.ts` | Export new schema |
| `packages/core/src/synthesize/llm.ts` | Replace Anthropic SDK with AI SDK + provider factory |
| `packages/core/src/synthesize/index.ts` | Thread LLMConfig through to llmGenerate |
| `packages/core/src/synthesize/*.ts` | Add optional LLMConfig param (5 files) |
| `packages/core/src/pipeline/index.ts` | Thread LLMConfig from domain config |
| `packages/core/src/config/loader.ts` | Extract LLMConfig in domainToProfileAndSources |
| `packages/core/src/init/index.ts` | Accept optional LLMConfig |
| `packages/core/package.json` | Replace `@anthropic-ai/sdk` with `ai` + provider packages |
| `packages/cli/src/commands/run-weekly.ts` | Pass LLMConfig from domain |
| `packages/cli/src/commands/digest-weekly.ts` | Pass LLMConfig from domain |
| `configs/domains/*.yaml` | Add `llm:` section examples |
| `.env.example` | Add OPENAI_API_KEY, note about Ollama |

### Files NOT changed

The 5 synthesis sub-functions (`digest-entry.ts`, `weekly-summary.ts`, `topic-expand.ts`, `topic-sources.ts`, `compare.ts`) call `llmGenerate()` which keeps the same `(system, user, options?) → string` signature. The options type gains an optional `llmConfig` field, but existing calls without it use defaults.

### New dependency tree

```
ai                          # Core AI SDK (~50KB)
@ai-sdk/anthropic           # Anthropic adapter (~15KB)
@ai-sdk/openai              # OpenAI adapter (~15KB, also covers openai-compatible)
@ai-sdk/google              # Google adapter (~15KB)
ollama-ai-provider          # Ollama adapter (~10KB)
```

Removes: `@anthropic-ai/sdk` (replaced by `@ai-sdk/anthropic`)

## Testing Strategy

### Unit tests for provider factory

```typescript
// packages/core/test/synthesize/llm-provider.test.ts
describe("createProvider", () => {
  test("creates anthropic provider with default model");
  test("creates openai provider with default model");
  test("creates ollama provider with default model and base URL");
  test("creates google provider with default model");
  test("creates openai-compatible provider with custom base URL");
  test("defaults to anthropic when no config provided");
  test("throws on unknown provider");
  test("respects custom model override");
  test("respects custom base_url");
});
```

### Unit tests for LLMConfig schema

```typescript
// packages/core/test/types/llm-config.test.ts
describe("LLMConfigSchema", () => {
  test("validates minimal anthropic config");
  test("validates full config with all fields");
  test("rejects unknown provider");
  test("applies defaults correctly");
  test("validates openai-compatible requires base_url");
});
```

### Integration: domain config with LLM section

```typescript
// extend existing config loader tests
test("loads domain with llm config");
test("loads domain without llm config (defaults to anthropic)");
test("domainToProfileAndSources extracts llmConfig");
```

## Migration

### Backward compatible

- Domain configs without an `llm` section default to Anthropic with `claude-sonnet-4-20250514`
- `ANTHROPIC_API_KEY` env var continues to work as before
- No changes needed for existing users

### For users switching providers

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."
# Add to domain config:
#   llm:
#     provider: openai
#     model: gpt-4o

# Ollama (free, local)
ollama pull llama3.1
# Add to domain config:
#   llm:
#     provider: ollama
#     model: llama3.1
```

## Non-technical user impact

This directly supports the accessibility goal. The init wizard can ask:

```
? Which AI provider do you want to use?
  > Anthropic (Claude) — requires API key
    OpenAI (GPT-4) — requires API key
    Ollama (local, free) — requires Ollama installed
    Google (Gemini) — requires API key
```

Ollama is particularly important — it's free, runs locally, and doesn't require an API key. This removes the biggest barrier for non-technical users.
