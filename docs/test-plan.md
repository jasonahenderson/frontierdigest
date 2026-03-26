# Frontier Digest Test Plan

## Overview

Frontier Digest uses a three-tier testing strategy:

1. **Unit tests** — Test individual modules in isolation with fixture data, no mocks, no external calls
2. **Integration tests** — Test module boundaries and interactions with mocked external services (LLM, RSS, Slack)
3. **End-to-end tests** — Run the full pipeline or CLI as a complete system, verifying artifacts on disk

**Framework:** [Bun's built-in test runner](https://bun.sh/docs/cli/test) (`bun:test`)
**No external test dependencies** — uses Bun's native `mock`, `mock.module()`, `Bun.serve()`, and `Bun.spawn()`

---

## How to Run Tests

```bash
# All tests (unit + integration + e2e)
bun test --recursive

# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# End-to-end tests only
pnpm test:e2e

# Live LLM tests (requires API key, costs money)
FD_TEST_LLM=1 pnpm test:llm

# Live Slack tests (requires Slack tokens)
FD_TEST_SLACK=1 FD_SLACK_BOT_TOKEN=xoxb-... FD_SLACK_TEST_CHANNEL=C... bun test packages/slack/test/e2e/
```

### Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `FD_TEST_LLM` | `test:llm` | Enable live LLM API tests |
| `FD_TEST_SLACK` | Slack e2e | Enable live Slack API tests |
| `FD_SLACK_BOT_TOKEN` | Slack e2e | Slack bot token (xoxb-...) |
| `FD_SLACK_TEST_CHANNEL` | Slack e2e | Slack channel ID for test posts |
| `ANTHROPIC_API_KEY` | `test:llm` | API key for Anthropic (default provider) |

---

## Unit Tests

Pure logic tests with fixture data. No mocks, no external calls. Fast and deterministic.

| File | Module | Description |
|------|--------|-------------|
| `packages/core/test/types/schemas.test.ts` | types | Zod schema validation against valid/invalid fixtures |
| `packages/core/test/types/llm-config.test.ts` | types | LLM config schema and defaults |
| `packages/core/test/normalize/url-canonical.test.ts` | normalize | URL canonicalization (query params, fragments, trailing slashes) |
| `packages/core/test/normalize/normalize.test.ts` | normalize | Full normalization pipeline (hash, excerpt, ID generation) |
| `packages/core/test/dedupe/similarity.test.ts` | dedupe | Trigram generation and Dice coefficient |
| `packages/core/test/dedupe/dedupe.test.ts` | dedupe | Deduplication clustering with thresholds |
| `packages/core/test/score/formula.test.ts` | score | Scoring formula (relevance, recency, source weight, reinforcement) |
| `packages/core/test/pipeline/pipeline.test.ts` | pipeline | Pipeline stages: normalize -> dedupe -> score (no LLM) |
| `packages/core/test/synthesize/llm-provider.test.ts` | synthesize | LLM provider resolution and config defaults |
| `packages/core/test/sanitize/sanitize.test.ts` | sanitize | HTML stripping, text sanitization, Slack mrkdwn escaping |
| `packages/core/test/sanitize/prompt-injection.test.ts` | sanitize | Prompt injection defense (boundary markers, template escaping) |
| `packages/core/test/sanitize/path-traversal.test.ts` | sanitize | Path traversal prevention in file operations |
| `packages/core/test/persist/file-store.test.ts` | persist | FileStore round-trip (save/load) with temp directories |
| `packages/core/test/config/loader.test.ts` | config | YAML loading, profile/source/domain config validation |
| `packages/slack/test/formatter.test.ts` | slack | Slack block formatting, text utilities, digest blocks |

### Fixtures

Located in `packages/core/test/fixtures/`:

| File | Description |
|------|-------------|
| `raw-items.json` | 10 raw RSS-like items |
| `normalized-items.json` | 10 normalized items with IDs, hashes, canonical URLs |
| `digest-entries.json` | 3 synthesized digest entries |
| `weekly-digest.json` | Weekly digest metadata |
| `topic-pack.json` | Topic detail pack |
| `source-bundle.json` | Sources grouped by topic |
| `profile.yaml` | Test profile config |
| `sources.yaml` | Test source definitions |
| `rss-feed.xml` | RSS XML feed fixture |
| `domain-config-test.yaml` | Test domain config for integration tests |
| `llm-responses/*.json` | Canned LLM JSON responses for mocked synthesis |

---

## Integration Tests

Test module boundaries with mocked external services. Each test exercises real code paths across multiple modules, with only external API calls replaced.

| File | What It Tests | Mocked | Real |
|------|---------------|--------|------|
| `packages/core/test/integration/ingest-rss.test.ts` | RSS fetching via local HTTP server | Nothing (server is local) | `fetchRss`, `rss-parser`, sanitization, date windowing |
| `packages/core/test/integration/synthesize-mocked.test.ts` | All 5 synthesis functions with canned LLM responses | `llmGenerate` | Prompt loading, template substitution, Zod validation |
| `packages/core/test/integration/synthesize-llm-live.test.ts` | Real LLM API calls validate Zod output | Nothing | Full LLM round-trip (gated: `FD_TEST_LLM=1`) |
| `packages/core/test/integration/pipeline-full.test.ts` | Full `runWeeklyPipeline()` all 8 stages | `llmGenerate`, RSS (local server) | normalize, dedupe, score, cluster, FileStore, prompts |
| `packages/core/test/integration/persist-to-slack.test.ts` | Write artifacts to FileStore, read back through Slack formatters | Nothing | FileStore (temp dir), Slack block builders |
| `packages/core/test/integration/config-pipeline.test.ts` | Load domain config, extract profile/sources, validate | Nothing | Config loading, validation, `domainToProfileAndSources` |
| `packages/cli/test/integration/cli-smoke.test.ts` | CLI commands as subprocesses | None | Full CLI process, citty arg parsing |

### Key Test Cases

**ingest-rss.test.ts:**
- Fetches and parses RSS from local Bun server
- Respects date window filtering
- Returns empty array for 404 / malformed XML
- Aggregates from multiple sources
- Strips HTML from descriptions
- Populates source metadata correctly
- Handles one failing source gracefully

**synthesize-mocked.test.ts:**
- Each of 5 synthesis functions loads correct prompt and validates output against Zod schema
- Persona/focus from PromptContext appear in captured system prompts
- Untrusted content wrapped in `<source_data>` boundary markers
- Handles null previous topic pack in comparison

**pipeline-full.test.ts:**
- Full pipeline completes with all 8 steps in order
- All steps report "completed" status
- Empty feeds -> graceful completion with 0 items
- One failing source -> partial results from others

**persist-to-slack.test.ts:**
- Persist digest then format for Slack -> valid blocks
- Persist topic pack -> valid expand reply blocks
- Persist source bundle -> valid sources reply blocks
- Full round-trip: all artifact data survives save/load
- Topic history tracks multiple saves

**config-pipeline.test.ts:**
- Domain config loads and extracts profile/sources/promptContext/llmConfig
- Validates successfully for valid config
- Namespaces root_dir by domain ID
- Real ai-frontier domain config loads and validates

**cli-smoke.test.ts:**
- `--help` prints usage
- `validate --domain` with valid config exits 0
- `validate --profile --sources` with fixtures exits 0
- Unknown command exits with non-zero or error
- Missing file exits with error

---

## End-to-End Tests

Run the full system from entry to output, verifying real artifacts.

| File | Scope | Gating |
|------|-------|--------|
| `packages/core/test/e2e/pipeline-e2e.test.ts` | Local RSS server -> full pipeline -> artifacts on disk | None (LLM mocked) |
| `packages/cli/test/e2e/cli-e2e.test.ts` | CLI commands as subprocesses with test configs | None |
| `packages/slack/test/e2e/slack-e2e.test.ts` | Post digest to real Slack channel | `FD_TEST_SLACK=1` |

### Key Test Cases

**pipeline-e2e.test.ts:**
- Starts 3 RSS feeds on local server (with overlapping content)
- Runs full pipeline with mocked LLM
- Verifies all artifact files exist on disk
- Validates artifacts against Zod schemas (WeeklyDigest, DigestEntry, RunManifest)
- Verifies dedupe reduces item count for duplicate URLs
- Verifies entry count respects `max_digest_items`

**cli-e2e.test.ts:**
- `run weekly` with test profile starts and produces pipeline output
- `validate` with domain config exits 0
- `ingest` with fixture sources runs without crashing

**slack-e2e.test.ts:**
- Posts weekly digest to real Slack test channel
- Verifies result.ok and message timestamp returned

---

## Test Helpers

Located in `packages/core/test/helpers/`:

| File | Purpose |
|------|---------|
| `fixtures.ts` | Centralized `loadFixture<T>()` and `FIXTURES_DIR` constant |
| `mock-llm.ts` | LLM mock factory with prompt-based response routing and call capture |
| `mock-rss-server.ts` | Local HTTP server via `Bun.serve()` for RSS feed testing |
| `mock-store.ts` | In-memory `Store` implementation for fast tests |

Located in `packages/slack/test/helpers/`:

| File | Purpose |
|------|---------|
| `mock-slack.ts` | Mock Slack WebClient with call recording |

---

## Coverage Map

| Module | Unit | Integration | E2E |
|--------|:----:|:-----------:|:---:|
| types/schemas | x | | |
| types/llm-config | x | | |
| normalize | x | x (pipeline) | x |
| dedupe | x | x (pipeline) | x |
| score | x | x (pipeline) | x |
| cluster | | x (pipeline) | x |
| ingest/rss | | x (local server) | x |
| synthesize/llm | x (config) | x (mocked + live) | x (mocked) |
| synthesize/digest-entry | | x (mocked) | x |
| synthesize/topic-expand | | x (mocked) | x |
| synthesize/topic-sources | | x (mocked) | x |
| synthesize/compare | | x (mocked) | x |
| synthesize/weekly-summary | | x (mocked) | x |
| synthesize/prompt-loader | | x (via synthesis) | x |
| persist/file-store | x | x (round-trip) | x |
| config/loader | x | x (config-pipeline) | x (CLI) |
| config/validate | | x (config-pipeline) | x (CLI) |
| pipeline | x (partial) | x (full) | x |
| sanitize | x | x (via pipeline) | x |
| slack/blocks | x | x (persist-to-slack) | |
| slack/formatter | x | | |
| slack/post | | | x (gated) |
| cli commands | | x (smoke) | x |

---

## CI/CD Recommendations

| Stage | Command | When |
|-------|---------|------|
| **Default CI** | `bun test --recursive` | Every push/PR |
| **Unit only** (fast) | `pnpm test:unit` | Pre-commit hook |
| **Integration** | `pnpm test:integration` | Every push/PR |
| **E2E** | `pnpm test:e2e` | Every push/PR |

### Gated Tests (Manual)

These tests hit real external services and are **skipped by default**. They should be run manually in specific situations — never as part of routine CI.

**Live LLM tests** — run after changing prompt templates, synthesis logic, or upgrading model versions:

```bash
FD_TEST_LLM=1 pnpm test:llm
```

Requires `ANTHROPIC_API_KEY` (or the relevant provider key). Validates that real LLM output parses against Zod schemas.

**Live Slack tests** — run before deploying changes to Slack posting or block formatting:

```bash
FD_TEST_SLACK=1 FD_SLACK_BOT_TOKEN=xoxb-... FD_SLACK_TEST_CHANNEL=C... bun test packages/slack/test/e2e/
```

Requires a dedicated test channel to avoid noise in production channels.

### Open Question: Nightly LLM CI

A nightly CI job running `FD_TEST_LLM=1 pnpm test:llm` with a budget-limited API key would catch model drift or API-breaking changes between manual runs. Trade-offs:
- **Pro:** Catches regressions from upstream model updates without developer action
- **Con:** Ongoing API cost, needs key management in CI, flaky by nature (LLM output varies)
- **Minimal version:** Run only `generateDigestEntry` — it covers the full prompt-to-Zod-parse path

This is not yet implemented. Decide based on how frequently model/provider changes cause breakage.

### Timeouts

- Unit tests: default (5s)
- Integration tests: 30s
- E2E tests: 60s
- Live LLM tests: 60s per test

### On Failure

- Integration/E2E tests with temp directories: contents are cleaned up via `afterAll`
- For debugging, set `FD_TEST_KEEP_TEMP=1` to skip cleanup (not yet implemented)
- CLI tests capture stdout/stderr for assertion — check test output for details
