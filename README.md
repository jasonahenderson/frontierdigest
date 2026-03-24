# Frontier Digest

A weekly AI frontier digest system that collects developments from configured RSS sources, synthesizes them into a ranked digest, and delivers it to Slack with thread-based drill-down.

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

### Configure

Copy the sample configs and edit them:

```bash
cp configs/profile.sample.yaml configs/profile.yaml
cp configs/sources.sample.yaml configs/sources.yaml
cp configs/slack.sample.yaml configs/slack.yaml
```

Set required environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_SIGNING_SECRET="..."
export SLACK_APP_TOKEN="xapp-..."   # optional, enables Socket Mode
```

### Run

Run the full weekly pipeline (ingest through synthesis and persistence):

```bash
bun run cli run weekly --profile configs/profile.yaml --sources configs/sources.yaml
```

Post the latest digest to Slack:

```bash
bun run cli slack post weekly --profile configs/profile.yaml
```

## CLI Commands

```bash
bun run cli <command>
```

| Command | Description |
|---------|-------------|
| `ingest` | Fetch items from configured RSS sources |
| `digest weekly` | Generate a weekly digest from ingested items |
| `run weekly` | Run the full pipeline (ingest + digest + persist) |
| `slack post weekly` | Post the latest digest to Slack |
| `topic show <id>` | Display a topic pack |
| `topic sources <id>` | Display sources for a topic |
| `diff weekly` | Compare current and previous weekly digests |
| `list digests` | List all generated digests |
| `inspect run <id>` | Show details of a pipeline run |
| `validate` | Validate configuration files |

## Configuration

Configuration uses three YAML files in `configs/`:

- **`profile.yaml`** -- Interest topics, scoring weights, lookback window, output settings
- **`sources.yaml`** -- RSS feed registry with URLs, weights, and tags
- **`slack.yaml`** -- Slack channel, bot token references, and threading settings

See the `.sample.yaml` files for annotated examples.

### Scoring Weights

The profile config controls how items are ranked:

```yaml
ranking:
  max_digest_items: 8
  relevance_weight: 0.4
  source_weight: 0.2
  recency_weight: 0.2
  reinforcement_weight: 0.2
  primary_source_bonus: 0.2
```

## Architecture

The system has four layers: **Collection**, **Preparation**, **Synthesis**, and **Delivery**. The pipeline runs 8 steps: ingest, normalize, dedupe, score, cluster, synthesize, persist, and save manifest.

LLM calls are isolated to the synthesis step. Slack drill-down reads pre-generated artifacts and never triggers LLM calls.

See [docs/architecture.md](docs/architecture.md) for the full architecture overview.

## Project Structure

```
packages/
  core/    Domain logic, pipeline, types, persistence
  cli/     CLI commands (citty)
  slack/   Slack formatting and interaction handling
configs/   Sample YAML configuration files
prompts/   LLM prompt templates (Markdown with {{variable}} placeholders)
data/      Generated artifacts (raw, normalized, digests, topics, runs)
docs/      Documentation
```

## Documentation

- [Architecture](docs/architecture.md) -- System overview, data flow, design decisions
- [Slack Contract](docs/slack-contract.md) -- Permissions, message format, interaction handlers
- [Security](docs/security.md) -- Secrets, permissions, data storage
- [Tech Spec](docs/tech-spec.md) -- Full MVP specification

## Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies: `pnpm install`
3. Run tests: `bun test`
4. Run type checking: `pnpm run lint`
5. Ensure all tests pass before submitting a pull request.

### Development Commands

```bash
pnpm install          # Install dependencies
bun test              # Run all tests
pnpm run lint         # TypeScript type checking (tsc --noEmit)
bun run cli           # Run the CLI
```

Types are defined as Zod schemas in `packages/core/src/types/`. When adding new data contracts, define the Zod schema first and infer the TypeScript type from it.

## License

MIT
