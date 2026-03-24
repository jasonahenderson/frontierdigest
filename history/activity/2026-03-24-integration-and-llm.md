---
date: 2026-03-24
summary: Closed integration gaps, added multi-provider LLM support, enhanced setup UX
---

## Session: Integration Fixes + Multi-Provider LLM + Setup UX

### Integration gaps closed
- PromptContext threaded through entire pipeline: domain config → pipeline → synthesize → all sub-functions → prompt loader
- Slack digest title now configurable via domain name (was hardcoded "AI Frontier Digest")
- Persistence paths fixed: removed double-nesting (data/domain/data/raw → data/domain/raw)
- E2E live test verified: 593 items from 5 RSS feeds → 41 canonical → 3 clusters

### Multi-provider LLM support
- Replaced hardcoded @anthropic-ai/sdk with Vercel AI SDK (ai package)
- New LLMConfig schema: provider, model, api_key_env, base_url, temperature, max_tokens
- 5 providers: Anthropic, OpenAI, Ollama (local/free), Google Gemini, OpenAI-compatible
- Provider factory with per-provider defaults (model, API key env var)
- LLMConfig threaded through domain config → pipeline → synthesize → llm
- 46 new tests (184 total): schema validation, provider factory, config integration
- docs/llm-providers.md: full provider matrix, config reference, migration guide

### Setup UX enhancements
- Init wizard now auto-detects available providers (probes Ollama, checks env vars)
- Interactive provider selection with status hints
- Ollama model picker lists installed models
- Provider-aware error handling
- setup.sh gains LLM provider detection section
- README updated: Vercel AI SDK in tech stack, LLM Providers doc link

### Files changed
- packages/core/src/types/llm-config.ts (new)
- packages/core/src/synthesize/llm.ts (rewritten for AI SDK)
- packages/core/src/synthesize/*.ts (5 files — added llmConfig param)
- packages/core/src/synthesize/index.ts, pipeline/index.ts, config/loader.ts
- packages/cli/src/commands/init.ts, run-weekly.ts, digest-weekly.ts
- configs/domains/*.yaml (added llm section)
- docs/llm-providers.md, docs/tech-spec.md
- setup.sh, README.md
- 3 new test files

### Stats
- 184 tests passing, 0 type errors
- 7 commits pushed to github.com/jasonahenderson/frontierdigest
