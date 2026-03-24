# Architecture

## System Overview

Frontier Digest processes RSS sources through a four-layer pipeline, producing a weekly digest with pre-generated drill-down artifacts.

```
 +----------------+     +----------------+     +----------------+     +----------------+
 |   Collection   | --> |  Preparation   | --> |   Synthesis    | --> |   Delivery     |
 |                |     |                |     |                |     |                |
 | - RSS ingest   |     | - Normalize    |     | - Digest entry |     | - Slack post   |
 | - Raw storage  |     | - Dedupe       |     | - Topic expand |     | - Thread       |
 |                |     | - Score        |     | - Sources      |     |   drill-down   |
 |                |     | - Cluster      |     | - Compare      |     |                |
 |                |     |                |     | - Weekly sum.  |     |                |
 +----------------+     +----------------+     +----------------+     +----------------+
        |                      |                      |                      |
        v                      v                      v                      v
   data/raw/            data/normalized/       data/digests/           Slack channel
                                               data/topics/
```

## Package Structure

The project is a pnpm monorepo with three packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@frontier-digest/core` | `packages/core/` | Domain logic, data pipeline, types, persistence |
| `@frontier-digest/cli` | `packages/cli/` | Operator interface (citty commands) |
| `@frontier-digest/slack` | `packages/slack/` | Slack formatting, posting, and interaction handling |

### core

Contains all pipeline stages as independent modules:

- `types/` -- Zod schemas and inferred TypeScript types
- `config/` -- YAML config loading and validation
- `ingest/` -- RSS fetching
- `normalize/` -- Raw-to-common-schema conversion
- `dedupe/` -- URL canonicalization, fingerprint matching, similarity detection
- `score/` -- Relevance, recency, reinforcement scoring
- `cluster/` -- Topic grouping with label generation
- `synthesize/` -- LLM-based digest generation (the only module that calls an LLM)
- `persist/` -- File-based Store abstraction
- `pipeline/` -- End-to-end orchestration and run tracking

### cli

Subcommands built on `citty`: `ingest`, `digest`, `slack`, `topic`, `diff`, `validate`, `run`, `list`, `inspect`. Each command loads config, instantiates a `FileStore`, and calls into `core`.

### slack

Bolt-based Slack app with Block Kit formatting and interactive button handlers. Reads pre-generated artifacts from the Store -- never triggers LLM calls at interaction time.

## Data Flow

The pipeline runs 8 sequential steps. Each step feeds the next.

| Step | Module | Input | Output |
|------|--------|-------|--------|
| 1. Ingest | `core/ingest` | Source configs, profile | Raw items (per-source JSON) |
| 2. Normalize | `core/normalize` | Raw items | `NormalizedItem[]` |
| 3. Dedupe | `core/dedupe` | Normalized items | Canonical items, dedupe clusters |
| 4. Score | `core/score` | Canonical items, profile, sources | `ScoredItem[]` |
| 5. Cluster | `core/cluster` | Scored items, profile | `TopicCluster[]` |
| 6. Synthesize | `core/synthesize` | Clusters, profile, store | `DigestEntry[]`, `TopicPack[]`, `SourceBundle[]`, `WeeklyDigest` |
| 7. Persist | `core/persist` | All synthesis artifacts | Files written to `data/` |
| 8. Save manifest | `core/pipeline` | Run state | `RunManifest` JSON |

Delivery (Slack posting) is a separate command that reads persisted artifacts.

## Persistence Layout

```
data/
  raw/YYYY/MM/DD/<source-id>.json       Raw fetched items
  normalized/YYYY/MM/DD/items.json      Normalized items
  digests/YYYY/MM/DD/
    weekly.json                         WeeklyDigest object
    weekly.md                           Markdown rendering
    entries.json                        DigestEntry[] for the week
  topics/<topic-key>/
    latest.json                         Most recent TopicPack
    history.json                        Array of all TopicPacks over time
    <YYYY_MM_DD>.json                   Date-stamped snapshot
    sources/<YYYY_MM_DD>.json           SourceBundle for that week
  runs/
    <run-id>.json                       RunManifest with step-level status
```

All IDs are stable and allow cross-referencing between artifacts. The `FileStore` class implements the `Store` interface, providing read/write access to this layout.

## LLM Usage Boundaries

LLM calls are strictly isolated to `packages/core/src/synthesize/`. Every other module uses deterministic logic or heuristics.

| Module | Uses LLM? | Approach |
|--------|-----------|----------|
| Ingest | No | HTTP fetch + RSS parsing |
| Normalize | No | String processing, hashing |
| Dedupe | No | URL canonicalization, Jaccard similarity, fingerprints |
| Score | No | Weighted formula from config |
| Cluster | No (label generation uses LLM) | Overlap-based grouping; LLM for label text |
| Synthesize | **Yes** | Digest entries, topic expansion, source summaries, comparisons, weekly summary |
| Persist | No | File I/O |
| Slack interactions | No | Reads pre-generated artifacts |

The LLM client (`@anthropic-ai/sdk`) reads `ANTHROPIC_API_KEY` from the environment. All LLM calls go through `synthesize/llm.ts` which wraps the Anthropic Messages API.

## Key Design Decisions

### CLI-first architecture

The system runs entirely from CLI commands. This keeps the core portable, simplifies testing, and avoids coupling to any hosting platform. Slack posting and interaction handling are invoked as CLI subcommands.

### Pre-generated drill-down

When a user clicks "Expand", "Sources", or "Compare" in Slack, the handler reads a pre-generated artifact from the Store. No LLM call happens at interaction time. This means drill-down is fast, predictable, and does not incur API costs per click.

### Zod as single source of truth for types

All data contracts (`NormalizedItem`, `DigestEntry`, `TopicPack`, `WeeklyDigest`, etc.) are defined as Zod schemas in `packages/core/src/types/`. TypeScript types are inferred from Zod using `z.infer<>`. This gives runtime validation and compile-time types from a single definition.

### File-based persistence with Store abstraction

The `Store` interface defines read/write operations for all artifact types. `FileStore` implements it using the local filesystem with a date-based directory structure. This can be swapped for other backends without changing pipeline code.

### Prompt templates as external files

LLM prompts live in `prompts/` as Markdown files with `{{variable}}` placeholders. This keeps prompts editable and version-controlled separately from code. The `prompt-loader.ts` module reads and interpolates them at runtime.
