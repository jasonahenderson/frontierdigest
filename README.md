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
./setup.sh
```

The setup script checks prerequisites (Bun >= 1.0, pnpm >= 9, Node.js >= 20), installs dependencies, creates your `.env` file, and validates the installation. Run `./setup.sh --help` for options.

<details>
<summary>Manual install</summary>

```bash
pnpm install
cp .env.example .env
# Edit .env with your API keys
```

</details>

> **Requires:** [Bun](https://bun.sh/) >= 1.0, [pnpm](https://pnpm.io/) >= 9, [Node.js](https://nodejs.org/) >= 20

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

Set your LLM provider API key:

```bash
# Anthropic (default)
export ANTHROPIC_API_KEY="sk-ant-..."

# Or use a different provider — see "LLM Providers" below
export OPENAI_API_KEY="sk-..."           # OpenAI
export GOOGLE_GENERATIVE_AI_API_KEY="…"  # Google Gemini
# Ollama needs no key — just a running local server
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
                                                                      LLM Provider
                                                          (Anthropic, OpenAI, Ollama, Google)
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

A domain config is a single YAML file that bundles everything: topic interests, RSS sources, LLM provider, prompt persona, scoring weights, and Slack routing.

```yaml
domain:
  id: quantum-computing
  name: "Quantum Computing Frontier"

  prompt_context:
    persona: "You are a quantum computing research analyst..."
    focus: "quantum computing hardware, algorithms, and applications"

  llm:
    provider: anthropic          # anthropic | openai | ollama | google | openai-compatible
    model: claude-sonnet-4-20250514  # optional — uses provider default if omitted

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

Domains are fully isolated — separate sources, storage (`data/<domain-id>/`), Slack channels, and LLM configs. Run as many as you want.

---

## LLM Providers

Frontier Digest supports multiple LLM providers via the [Vercel AI SDK](https://sdk.vercel.ai/). Configure per-domain in the `llm:` section.

| Provider | Config value | Default model | API key env var | Notes |
|----------|-------------|---------------|-----------------|-------|
| Anthropic | `anthropic` | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` | Default provider |
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` | |
| Ollama | `ollama` | `llama3.1` | None (local) | Free, private, no API key |
| Google | `google` | `gemini-2.0-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` | |
| Custom | `openai-compatible` | `gpt-4o` | `OPENAI_API_KEY` | Requires `base_url` |

### Examples

```yaml
# Use OpenAI GPT-4o
llm:
  provider: openai

# Use a local Ollama model (free, no API key)
llm:
  provider: ollama
  model: llama3.1
  base_url: http://localhost:11434  # default Ollama address

# Use Google Gemini
llm:
  provider: google
  model: gemini-2.0-flash

# Use a custom OpenAI-compatible endpoint (e.g., Together, Groq, vLLM)
llm:
  provider: openai-compatible
  base_url: https://api.together.xyz/v1
  model: meta-llama/Llama-3-70b-chat-hf

# Advanced: custom temperature and token limits
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.3
  max_tokens: 4096
```

If no `llm:` section is provided, Frontier Digest defaults to Anthropic with Claude Sonnet 4.

See [docs/llm-providers.md](docs/llm-providers.md) for the full provider guide.

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
| LLM | [Vercel AI SDK](https://sdk.vercel.ai/) — Anthropic, OpenAI, Ollama, Google |
| Testing | bun:test (184 tests) |

---

## Documentation

- **[Architecture](docs/architecture.md)** — System layers, data flow, design decisions
- **[Slack Contract](docs/slack-contract.md)** — Permissions, message format, drill-down actions
- **[LLM Providers](docs/llm-providers.md)** — Provider setup, model options, local vs cloud
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
