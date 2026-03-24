<p align="center">
  <strong>Frontier Digest</strong><br>
  <em>Your weekly research radar, for any domain.</em>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#how-it-works">How It Works</a> &middot;
  <a href="#domain-configs">Domain Configs</a> &middot;
  <a href="docs/architecture.md">Architecture</a> &middot;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

**Frontier Digest** turns a stream of RSS sources into a focused weekly digest, delivered to Slack with one-click drill-down into summaries, sources, and week-over-week trends.

It works for any topic. Tell it what you care about and it handles the rest:

```bash
frontier-digest init
# ? What topic do you want to track?
# > quantum computing breakthroughs and hardware advances
#
# Generated domain: "Quantum Computing Frontier"
# Config written to configs/domains/quantum-computing.yaml
#
# Run: frontier-digest run weekly --domain configs/domains/quantum-computing.yaml
```

### Built-in domain templates

| Domain | Description | Sources |
|--------|-------------|---------|
| `ai-frontier` | AI research, models, agents, infrastructure | Anthropic, OpenAI, DeepMind, arXiv, Latent Space, Simon Willison |
| `quantum-computing` | Quantum hardware, algorithms, error correction | arXiv quant-ph, CS.ET |
| `brain-science` | Neuroscience, cognitive science, BCIs | arXiv q-bio.NC |

Or describe any topic and the init wizard generates a custom config with relevant sources.

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/jasonahenderson/frontierdigest.git
cd frontierdigest
pnpm install
```

> **Requires:** [Bun](https://bun.sh/), [pnpm](https://pnpm.io/), and an [Anthropic API key](https://console.anthropic.com/)

### 2. Configure

Pick your path:

```bash
# Interactive — describe a topic, get a config
frontier-digest init

# From a template
frontier-digest init --template ai-frontier

# Manual — copy and edit
cp configs/domains/ai-frontier.yaml configs/domains/my-domain.yaml
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

For Slack delivery (optional):

```bash
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_SIGNING_SECRET="..."
```

### 3. Run

```bash
frontier-digest run weekly --domain configs/domains/ai-frontier.yaml
```

That's it. Your digest is in `data/ai-frontier/digests/` as Markdown and JSON.

To post to Slack:

```bash
frontier-digest slack post weekly --domain configs/domains/ai-frontier.yaml
```

> **Note:** `frontier-digest` is an alias for `bun run packages/cli/src/index.ts`. Until a global install is set up, use the full path.

---

## How It Works

```
RSS Feeds ──> Ingest ──> Normalize ──> Dedupe ──> Score ──> Cluster ──> Synthesize ──> Slack
                                                                            |
                                                                      Anthropic API
```

**8 pipeline steps**, each producing inspectable artifacts:

| Step | What it does | LLM? |
|------|-------------|------|
| **Ingest** | Fetch RSS feeds within the lookback window | No |
| **Normalize** | Common schema, canonical URLs, content hashing | No |
| **Dedupe** | URL matching, title similarity, content fingerprinting | No |
| **Score** | Relevance, recency, source quality, cross-source reinforcement | No |
| **Cluster** | Group related items into digest topics | No |
| **Synthesize** | Generate summaries, expansions, source analysis, comparisons | **Yes** |
| **Persist** | Write all artifacts to disk (JSON + Markdown) | No |
| **Deliver** | Post to Slack with Expand / Sources / Compare buttons | No |

LLM calls are isolated to synthesis. Everything else is deterministic. Slack drill-down reads pre-generated artifacts — no LLM calls at interaction time.

---

## Domain Configs

A domain config is a single YAML file that bundles everything: topic interests, RSS sources, LLM persona, scoring weights, and Slack routing.

```yaml
domain:
  id: quantum-computing
  name: "Quantum Computing Frontier"

  prompt_context:
    persona: "You are a quantum computing research analyst..."
    focus: "quantum computing hardware, algorithms, and applications"

  profile:
    interests:
      include: [quantum error correction, topological qubits, quantum advantage]
      exclude: [quantum mysticism, cryptocurrency mining]
    ranking:
      max_digest_items: 8

  sources:
    - id: arxiv-quant-ph
      type: rss
      name: arXiv quant-ph
      url: http://export.arxiv.org/rss/quant-ph
      weight: 1.0
      tags: [research, quantum]

  slack:
    channel: "#quantum-radar"
```

Domains are fully isolated — separate sources, storage (`data/<domain-id>/`), and Slack channels. Run as many as you want.

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `init` | Interactive setup wizard |
| `init --template <name>` | Create config from a built-in template |
| `run weekly --domain <path>` | Full pipeline: ingest through delivery |
| `ingest --domain <path>` | Fetch sources only |
| `digest weekly --domain <path>` | Generate digest from existing data |
| `slack post weekly --domain <path>` | Post latest digest to Slack |
| `topic show <id>` | Inspect a topic |
| `topic sources <id>` | View sources for a topic |
| `diff weekly` | Compare two weekly digests |
| `list digests` | List all generated digests |
| `inspect run <id>` | View pipeline run details |
| `validate --domain <path>` | Validate a config file |

---

## Project Structure

```
packages/
  core/        Pipeline logic, types (Zod), persistence, config loading
  cli/         CLI commands via citty
  slack/       Slack Block Kit formatting + Bolt interaction handlers
configs/
  domains/     Domain config files (one per topic)
prompts/       LLM prompt templates (Markdown, domain-agnostic)
data/          Runtime artifacts, namespaced by domain (gitignored)
docs/          Architecture, Slack contract, security docs
skills/        OpenClaw integration (placeholder)
```

## Tech Stack

| Concern | Choice |
|---------|--------|
| Runtime | [Bun](https://bun.sh/) |
| Language | TypeScript (strict, no build step) |
| Monorepo | pnpm workspaces |
| Validation | [Zod](https://zod.dev/) (types inferred, never hand-written) |
| CLI | [citty](https://github.com/unjs/citty) |
| Slack | [@slack/bolt](https://slack.dev/bolt-js/) |
| LLM | [Anthropic SDK](https://docs.anthropic.com/en/docs/sdks) |
| Testing | bun:test (138 tests) |

---

## Documentation

- **[Architecture](docs/architecture.md)** — System layers, data flow, design decisions
- **[Slack Contract](docs/slack-contract.md)** — Permissions, message format, drill-down actions
- **[Security](docs/security.md)** — Secrets management, least-privilege Slack setup
- **[Tech Spec](docs/tech-spec.md)** — Full MVP specification
- **[Contributing](CONTRIBUTING.md)** — Setup, conventions, how to add source types and domains

## Development

```bash
pnpm install          # Install dependencies
bun test              # Run all tests
pnpm run lint         # Type check (tsc --noEmit)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

## License

[MIT](LICENSE) &copy; Jason A. Henderson
