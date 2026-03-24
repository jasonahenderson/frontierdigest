# Frontier Digest

A domain-configurable weekly research digest system. Track developments in any topic area — AI, quantum computing, neuroscience, travel, or anything with a meaningful source stream. Collects from RSS feeds, synthesizes via LLM, and delivers to Slack with thread-based drill-down.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [pnpm](https://pnpm.io/) package manager
- An [Anthropic API key](https://console.anthropic.com/) for digest synthesis

### Install

```bash
git clone https://github.com/jasonahenderson/frontierdigest.git
cd frontierdigest
pnpm install
```

### Option A: Interactive Setup (recommended)

The init wizard generates a complete domain config from a natural-language topic description:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
bun run packages/cli/src/index.ts init
```

It will ask what you want to track, generate interests/sources/prompts via LLM, and write the config for you.

### Option B: Use a Template

```bash
bun run packages/cli/src/index.ts init --template ai-frontier
bun run packages/cli/src/index.ts init --template quantum-computing
bun run packages/cli/src/index.ts init --template brain-science
```

### Option C: Manual Config

Copy and edit a sample domain config:

```bash
cp configs/domains/ai-frontier.yaml configs/domains/my-domain.yaml
# Edit the file to customize interests, sources, and Slack channel
```

### Set Environment Variables

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export SLACK_BOT_TOKEN="xoxb-..."        # for Slack delivery
export SLACK_SIGNING_SECRET="..."         # for Slack delivery
export SLACK_APP_TOKEN="xapp-..."         # optional, enables Socket Mode
```

### Run

```bash
# Full weekly pipeline with a domain config
bun run packages/cli/src/index.ts run weekly --domain configs/domains/ai-frontier.yaml

# Post the latest digest to Slack
bun run packages/cli/src/index.ts slack post weekly --domain configs/domains/ai-frontier.yaml
```

## Domain Configs

A domain config bundles everything needed to run a digest for a specific topic:

```yaml
domain:
  id: quantum-computing
  name: "Quantum Computing Frontier"

  prompt_context:
    persona: "You are a quantum computing research analyst..."
    focus: "quantum computing hardware, algorithms, and applications"

  profile:
    interests:
      include: [quantum error correction, topological qubits, ...]
      exclude: [quantum mysticism, ...]
    ranking:
      max_digest_items: 8

  sources:
    - id: arxiv-quant-ph
      type: rss
      url: http://export.arxiv.org/rss/quant-ph
      ...

  slack:
    channel: "#quantum-radar"
```

Multiple domains run independently with separate sources, prompt personas, Slack channels, and data storage.

See `configs/domains/` for complete examples.

## CLI Commands

```bash
bun run packages/cli/src/index.ts <command>
```

| Command | Description |
|---------|-------------|
| `init` | Interactive setup wizard — generates a domain config from natural language |
| `init --template <name>` | Create a config from a built-in template |
| `run weekly --domain <path>` | Run the full pipeline (ingest + digest + persist) |
| `ingest --domain <path>` | Fetch items from configured RSS sources |
| `digest weekly --domain <path>` | Generate a digest from already-ingested items |
| `slack post weekly --domain <path>` | Post the latest digest to Slack |
| `topic show <id>` | Display a topic pack |
| `topic sources <id>` | Display sources for a topic |
| `diff weekly` | Compare current and previous weekly digests |
| `list digests` | List all generated digests |
| `inspect run <id>` | Show details of a pipeline run |
| `validate --domain <path>` | Validate a domain config file |

All commands also accept `--profile` + `--sources` flags for backward compatibility with separate config files.

## How It Works

The pipeline runs 8 steps:

1. **Ingest** — Fetch RSS feeds within the lookback window
2. **Normalize** — Common schema, canonical URLs, content hashing
3. **Dedupe** — URL matching, title similarity, content fingerprinting
4. **Score** — Relevance, recency, source quality, cross-source reinforcement
5. **Cluster** — Group related items into digest topics
6. **Synthesize** — LLM generates summaries, expansions, source bundles, comparisons
7. **Persist** — Write all artifacts to disk (JSON + Markdown)
8. **Deliver** — Post to Slack with Expand/Sources/Compare drill-down buttons

LLM calls are isolated to the synthesis step. Slack drill-down reads pre-generated artifacts and never triggers LLM calls.

## Project Structure

```
packages/
  core/      Domain logic, pipeline, types, persistence
  cli/       CLI commands (citty)
  slack/     Slack formatting and interaction handling (Bolt)
configs/
  domains/   Domain config files (ai-frontier, quantum, brain-science)
prompts/     LLM prompt templates (Markdown with {{persona}}, {{focus}} variables)
data/        Generated artifacts — namespaced by domain ID (gitignored)
docs/        Documentation
skills/      OpenClaw skill wrapper (placeholder)
```

## Documentation

- [Architecture](docs/architecture.md) — System overview, data flow, design decisions
- [Slack Contract](docs/slack-contract.md) — Permissions, message format, interaction handlers
- [Security](docs/security.md) — Secrets, permissions, data storage
- [Tech Spec](docs/tech-spec.md) — Full MVP specification

## Development

```bash
pnpm install          # Install dependencies
bun test              # Run all tests (138 tests)
pnpm run lint         # TypeScript type checking
```

Types are defined as Zod schemas in `packages/core/src/types/`. All TypeScript types are inferred from Zod — never hand-maintained.

## License

MIT
