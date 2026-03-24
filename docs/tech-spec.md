# Frontier Digest MVP Technical Specification

## Document status

- **Project:** Frontier Digest
- **Version:** v0.1.1 MVP spec
- **Status:** Updated — multi-domain support added
- **Primary goal:** Deliver a weekly domain-configurable digest into Slack with grounded drill-down backed by persisted artifacts

---

## 1. Purpose

Frontier Digest is a **domain-configurable** research-radar system for tracking developments across a defined source set, synthesizing them into a weekly digest, and supporting drill-down into evidence, history, and comparisons.

The system is designed to work across any knowledge domain — AI frontier, quantum computing, travel, brain science, or any topic with a meaningful source stream.

The first release is designed to answer one concrete use case:

> Every Monday morning, deliver a compact, high-signal weekly digest into Slack, with thread-based drill-down for summary expansion, sources, and change-over-time.

Multiple domains can run independently with separate source sets, interest profiles, prompt personas, Slack channels, and persistence namespaces.

This system is intended to be publishable as open source and usable both with and without OpenClaw.

---

## 2. MVP scope

### In scope for v0.1

- Configurable source registry
- Weekly scheduled ingest over a bounded source set
- Normalization of collected items into a common schema
- URL canonicalization and basic de-duplication
- Relevance scoring and ranking
- Weekly digest generation
- Markdown and JSON output artifacts
- Slack posting of the weekly digest
- Slack thread drill-down for:
  - expanded summary
  - source/evidence view
  - comparison to previous week
- Local persistence of runs, digests, and normalized items
- CLI-first execution model
- OpenClaw integration via skill + cron wrapper later, not as core runtime

### Explicitly out of scope for v0.1

- Embedded web application
- Multi-user authentication / tenancy
- Autonomous source discovery
- Full graph visualization UI
- Graph database backend
- Plugin packaging as first-class OpenClaw plugin
- Real-time alerting
- Daily digests
- Advanced novelty modeling beyond simple prior-period comparison

---

## 3. Product goals

### Primary goals

1. **High signal, low noise**  
   The digest must reduce a larger source stream into a small number of meaningful developments.

2. **Grounded outputs**  
   Every digest item must be traceable to normalized source artifacts.

3. **Useful drill-down**  
   Slack interactions must expose more depth without requiring a separate UI.

4. **Reproducible runs**  
   A weekly run must be inspectable and regenerable from persisted artifacts.

5. **Open-source viability**  
   The system must be understandable, configurable, and testable by external contributors.

### Non-goals

- Competing with full analyst platforms
- Acting as a generic news aggregator
- Replacing deep research workflows
- Browsing the live web interactively for every drill-down question

---

## 4. System overview

The system has four runtime layers:

1. **Collection**  
   Pull configured sources for a bounded time window.

2. **Preparation**  
   Normalize, canonicalize, dedupe, and score collected items.

3. **Synthesis**  
   Generate weekly digest items and per-topic drill-down artifacts.

4. **Delivery**  
   Publish digest to Slack and expose thread-based drill-down commands.

### Core principle

Drill-down must operate primarily over **persisted analysis artifacts**, not fresh ad hoc browsing.

That means the core pipeline produces reusable intermediate objects, not just one final markdown file.

---

## 5. Architecture

### 5.1 Runtime shape

Recommended architecture:

- **packages/core** — domain logic and data pipeline
- **packages/cli** — operator interface and automation entrypoint
- **packages/slack** — Slack formatting and interaction handling
- **skills/frontier-digest** — OpenClaw skill wrapper and guidance

### Why CLI-first

A CLI-first architecture:

- keeps the core runtime portable
- reduces OpenClaw coupling
- improves testability
- simplifies CI and local iteration
- makes OSS packaging cleaner

---

### 5.2 Processing pipeline

#### Step 1: Ingest

For each configured source:

- fetch latest items within the lookback window
- extract raw content and metadata
- persist raw payloads to disk

#### Step 2: Normalize

Convert raw items into a common `NormalizedItem` structure:

- source identity
- title
- canonical URL
- publication time
- extracted text
- tags
- content hash

#### Step 3: Dedupe

Reduce repeated coverage via:

- URL canonicalization
- title/body similarity
- simple fingerprint matching
- optional source-priority tie-breaking

#### Step 4: Score

Assign scores for:

- source quality
- relevance to configured interests
- recency
- primary-source preference
- cross-source reinforcement

#### Step 5: Cluster

Group related items into candidate digest topics.

For v0.1 this can be lightweight and heuristic-driven. Full graph-based clustering is deferred.

#### Step 6: Synthesize

Generate:

- weekly digest summary
- digest entries
- expanded topic summaries
- evidence/source views
- previous-week comparisons

#### Step 7: Persist

Write out:

- run manifest
- digest markdown
- digest JSON
- topic artifacts
- source bundles
- logs

#### Step 8: Deliver

Post the weekly digest into Slack and attach drill-down actions.

---

## 6. Repository structure

```text
frontier-digest/
├─ README.md
├─ LICENSE
├─ pnpm-workspace.yaml
├─ package.json
├─ packages/
│  ├─ core/
│  │  ├─ src/
│  │  │  ├─ ingest/
│  │  │  ├─ normalize/
│  │  │  ├─ dedupe/
│  │  │  ├─ score/
│  │  │  ├─ cluster/
│  │  │  ├─ synthesize/
│  │  │  ├─ persist/
│  │  │  └─ types/
│  │  └─ test/
│  ├─ cli/
│  │  └─ src/
│  └─ slack/
│     └─ src/
├─ skills/
│  └─ frontier-digest/
│     ├─ SKILL.md
│     ├─ TOOLS.md
│     └─ examples/
├─ configs/
│  ├─ profile.sample.yaml
│  ├─ sources.sample.yaml
│  └─ slack.sample.yaml
├─ schemas/
│  ├─ config.schema.json
│  ├─ normalized-item.schema.json
│  ├─ digest-entry.schema.json
│  ├─ topic-pack.schema.json
│  └─ weekly-digest.schema.json
├─ prompts/
│  ├─ weekly-summary.md
│  ├─ topic-expand.md
│  ├─ topic-sources.md
│  └─ compare-last-week.md
├─ docs/
│  ├─ architecture.md
│  ├─ slack-contract.md
│  ├─ evaluation.md
│  └─ security.md
└─ data/
   ├─ raw/
   ├─ normalized/
   ├─ digests/
   ├─ topics/
   └─ runs/
```

---

## 7. Configuration model

### 7.1 Profile config

```yaml
profile: ai-frontier

window:
  weekly_lookback_days: 7

interests:
  include:
    - long horizon agents
    - context engineering
    - memory systems
    - tool use
    - evaluation
    - inference infrastructure
  exclude:
    - generic consumer AI apps
    - funding-only announcements

ranking:
  max_digest_items: 8
  primary_source_bonus: 0.2
  recency_weight: 0.2
  relevance_weight: 0.4
  source_weight: 0.2
  reinforcement_weight: 0.2

outputs:
  root_dir: ./data
  write_markdown: true
  write_json: true

slack:
  enabled: true
  channel: "#ai-radar"
  post_threads: true
```

### 7.2 Source registry

```yaml
sources:
  - id: anthropic-news
    type: rss
    name: Anthropic News
    url: https://example.com/rss
    weight: 1.0
    tags: [agents, reasoning]

  - id: openai-research
    type: rss
    name: OpenAI Research
    url: https://example.com/rss
    weight: 1.0
    tags: [models, agents]

  - id: latent-space
    type: rss
    name: Latent Space
    url: https://example.com/rss
    weight: 0.8
    tags: [analysis, tooling]
```

### 7.3 Domain config (v0.1.1)

A **domain config** bundles profile, sources, prompt context, and Slack routing into a single portable unit. This is the preferred configuration method for running multiple independent digest domains.

```yaml
# configs/domains/quantum-computing.yaml
domain:
  id: quantum-computing
  name: "Quantum Computing Frontier"
  description: "Weekly digest of quantum computing developments"

  prompt_context:
    persona: >
      You are a quantum computing research analyst tracking hardware advances,
      algorithm breakthroughs, error correction progress, and commercial applications.
    focus: "quantum computing hardware, algorithms, error correction, and applications"

  profile:
    window:
      weekly_lookback_days: 7
    interests:
      include:
        - quantum error correction
        - topological qubits
        - quantum advantage demonstrations
        - quantum algorithms
        - quantum networking
      exclude:
        - quantum mysticism
        - cryptocurrency mining
    ranking:
      max_digest_items: 8
      primary_source_bonus: 0.2
      recency_weight: 0.2
      relevance_weight: 0.4
      source_weight: 0.2
      reinforcement_weight: 0.2
    outputs:
      root_dir: ./data
      write_markdown: true
      write_json: true

  sources:
    - id: arxiv-quant-ph
      type: rss
      name: arXiv quant-ph
      url: http://export.arxiv.org/rss/quant-ph
      weight: 1.0
      tags: [research, quantum]

  slack:
    enabled: true
    channel: "#quantum-radar"
    post_threads: true
```

#### Domain config design principles

- A domain config is **self-contained** — everything needed to run a digest lives in one file
- The `prompt_context.persona` and `prompt_context.focus` fields replace hardcoded AI-specific language in prompt templates
- Persistence is **namespaced by domain ID**: `data/<domain-id>/digests/...`, `data/<domain-id>/topics/...`
- Multiple domains can run independently with no shared state
- The `--domain` CLI flag accepts a domain config as an alternative to `--profile` + `--sources`
- Backward compatible: the original `--profile` + `--sources` flags still work

#### Example domains

| Domain | Channel | Sources |
|--------|---------|---------|
| AI Frontier | #ai-radar | Anthropic, OpenAI, arXiv CS.AI, Latent Space |
| Quantum Computing | #quantum-radar | arXiv quant-ph, IBM Quantum, Google Quantum AI |
| Asia Travel | #travel-asia | travel blogs, airline feeds, tourism boards |
| Brain & Behavior | #neuro-radar | arXiv q-bio.NC, Nature Neuroscience, PubMed |

---

## 8. Data contracts

### 8.1 NormalizedItem

```json
{
  "id": "item_2026_03_23_001",
  "source_id": "anthropic-news",
  "source_name": "Anthropic News",
  "source_type": "rss",
  "title": "Context engineering for long-running agents",
  "url": "https://example.com/post",
  "canonical_url": "https://example.com/post",
  "published_at": "2026-03-22T14:10:00Z",
  "fetched_at": "2026-03-23T06:01:12Z",
  "author": "Example Author",
  "tags": ["agents", "memory"],
  "text": "Normalized extracted text...",
  "excerpt": "Short extracted excerpt...",
  "content_hash": "sha256:...",
  "language": "en"
}
```

### 8.2 DigestEntry

```json
{
  "id": "digest_2026_03_23_item_02",
  "title": "Context engineering is replacing prompt engineering",
  "summary": "Short summary...",
  "why_it_matters": "Why this matters...",
  "novelty_label": "high",
  "confidence_label": "high",
  "source_count": 8,
  "primary_source_count": 4,
  "source_ids": ["item_1", "item_2", "item_3"],
  "topic_ids": ["context-engineering"],
  "comparison_ref": "topic_context_engineering_2026_03_23"
}
```

### 8.3 TopicPack

```json
{
  "id": "topic_context_engineering_2026_03_23",
  "topic_key": "context-engineering",
  "title": "Context engineering is replacing prompt engineering",
  "expanded_summary": "Expanded synthesis...",
  "why_included": [
    "appeared across 8 distinct sources",
    "strong primary-source support",
    "connected to multiple high-priority themes"
  ],
  "what_is_new": [
    "greater focus on memory architecture",
    "clearer framing around context as infrastructure"
  ],
  "uncertainties": ["terminology durability is unclear"],
  "source_bundle_ref": "topic_context_engineering_sources_2026_03_23",
  "history_ref": "topic_context_engineering_history",
  "related_topics": ["long-horizon-agents", "memory-systems"]
}
```

### 8.4 WeeklyDigest

```json
{
  "id": "weekly_2026_03_23",
  "generated_at": "2026-03-23T07:42:11Z",
  "window_start": "2026-03-16T00:00:00Z",
  "window_end": "2026-03-23T00:00:00Z",
  "raw_item_count": 148,
  "canonical_item_count": 41,
  "top_item_count": 8,
  "summary": "Weekly summary text...",
  "entries": ["digest_2026_03_23_item_01", "digest_2026_03_23_item_02"],
  "new_theme_count": 3,
  "accelerating_count": 2,
  "cooling_count": 1,
  "run_ref": "run_2026_03_23_weekly_01"
}
```

---

## 9. Persistence layout

```text
data/
├─ raw/YYYY/MM/DD/*.json
├─ normalized/YYYY/MM/DD/*.json
├─ digests/YYYY/MM/DD/
│  ├─ weekly.md
│  ├─ weekly.json
│  └─ slack-payload.json
├─ topics/<topic-key>/
│  ├─ latest.json
│  ├─ history.json
│  └─ sources/
├─ runs/
│  └─ run_*.json
└─ logs/
   └─ *.log
```

### Domain-namespaced persistence (v0.1.1)

When using domain configs, all data is namespaced under the domain ID:

```text
data/
├─ ai-frontier/
│  ├─ raw/YYYY/MM/DD/*.json
│  ├─ normalized/...
│  ├─ digests/...
│  └─ topics/...
├─ quantum-computing/
│  ├─ raw/...
│  └─ ...
└─ runs/
   └─ run_*.json
```

### Persistence requirements

- All generated objects must have stable IDs
- All digest entries must map back to normalized items
- All Slack interactions must resolve against persisted topic artifacts
- Prior digest references must be stored explicitly for comparison operations
- Domain-namespaced data must be fully isolated between domains

---

## 10. CLI command surface

Initial command surface:

```bash
# Using domain config (preferred)
frontier-digest run weekly --domain configs/domains/ai-frontier.yaml
frontier-digest run weekly --domain configs/domains/quantum-computing.yaml

# Using separate profile + sources (backward compatible)
frontier-digest ingest --profile configs/profile.yaml --sources configs/sources.yaml
frontier-digest digest weekly --profile configs/profile.yaml
frontier-digest slack post weekly --profile configs/profile.yaml
frontier-digest topic show <topic-id>
frontier-digest topic sources <topic-id>
frontier-digest diff weekly --current latest --previous previous
```

### Setup commands (v0.1.1)

```bash
# Interactive setup wizard — generates a domain config from natural language
frontier-digest init

# Setup from a template
frontier-digest init --template quantum-computing
frontier-digest init --template brain-science

# Validate config
frontier-digest validate --domain configs/domains/my-domain.yaml
```

### `frontier-digest init` wizard flow

The init wizard is designed for non-technical users. It uses the LLM to generate a complete domain config from a natural-language topic description.

#### Step 1: Topic description
```
? What topic do you want to track?
> quantum computing breakthroughs and hardware advances
```

#### Step 2: LLM generates domain config
The wizard sends the topic description to the LLM, which generates:
- domain ID and name
- interests (include/exclude lists)
- prompt persona and focus
- suggested RSS source URLs for the topic

#### Step 3: Review and customize
```
Generated domain: "Quantum Computing Frontier"

Interests:
  ✓ quantum error correction
  ✓ topological qubits
  ✓ quantum advantage
  ✗ quantum mysticism (excluded)

Sources found:
  ✓ arXiv quant-ph (RSS)
  ✓ arXiv CS.ET (RSS)

? Accept this configuration? (Y/n/edit)
```

#### Step 4: Slack setup (optional)
```
? Post digests to Slack? (y/N)
> y
? Slack channel: #quantum-radar
? Do you have a Slack bot token? (y/N)
> n
  → Follow these steps to create one:
    1. Go to https://api.slack.com/apps
    2. Create New App → From Scratch
    3. Add scopes: chat:write, channels:read
    4. Install to workspace
    5. Copy the Bot Token (xoxb-...)
? Paste your bot token: xoxb-...
```

#### Step 5: Write config and test
```
✓ Config written to configs/domains/quantum-computing.yaml
✓ Environment variables saved to .env

Running first ingest...
✓ Fetched 47 items from 2 sources

Your digest is ready! Run:
  frontier-digest run weekly --domain configs/domains/quantum-computing.yaml
```

### Recommended near-term additions

```bash
frontier-digest list digests
frontier-digest inspect run <run-id>
```

---

## 11. Slack interaction contract

### 11.1 Primary weekly post

The weekly Slack post contains:

- digest title and date
- coverage stats
- top 5–8 digest items
- compact metadata per item
- interaction controls per item

#### Weekly post structure

```text
Weekly AI Frontier Digest — 2026-03-23
Coverage: 148 items → 41 canonical stories → 8 priority developments
Change vs last week: 3 new themes, 2 accelerating, 1 cooling

1. Long-horizon agent evaluation is becoming the bottleneck
   Sources: 6 | Primary: 3 | Novelty: High | Confidence: Medium

2. Context engineering is replacing prompt engineering
   Sources: 8 | Primary: 4 | Novelty: High | Confidence: High
```

#### Per-item actions

- `Expand`
- `Sources`
- `Compare`
- `Open report` (stubbed or local path in v0.1)

### 11.2 Expand action

Returns a thread reply containing:

- expanded summary
- why included
- what is new
- uncertainty notes

### 11.3 Sources action

Returns a thread reply containing:

- canonical sources
- primary/secondary labeling
- duplicate reduction notes
- extracted evidence snippets

### 11.4 Compare action

Returns a thread reply containing:

- previous-week framing
- current-week framing
- detected shifts
- trend interpretation

---

## 12. OpenClaw integration model

v0.1 is not implemented as an OpenClaw plugin.

### OpenClaw role in v0.1

- host skill instructions
- schedule weekly runs via cron
- optionally invoke CLI commands
- present digest results in chat if desired

### OpenClaw deliverables later

- `SKILL.md`
- example cron definition
- workspace conventions for persisted artifacts

This keeps the project portable while still aligning with OpenClaw workflows.

---

## 13. Scoring model

v0.1 scoring is heuristic, not model-trained.

### Inputs

- source weight from config
- keyword/topic relevance
- publication recency
- primary-source presence
- repeated appearance across distinct sources

### Example score formula

```text
score =
  (relevance_weight * relevance_score) +
  (source_weight * source_quality_score) +
  (recency_weight * recency_score) +
  (reinforcement_weight * reinforcement_score) +
  primary_source_bonus
```

### Notes

- This is intentionally simple for the MVP
- Novelty is approximated through comparison with prior digest topics, not a full semantic novelty engine
- Scoring behavior must be inspectable in persisted run outputs

---

## 14. Dedupe model

v0.1 dedupe should be conservative and interpretable.

### Required steps

- canonicalize URLs
- strip query-tracking parameters
- normalize titles
- compare title similarity
- compare excerpt/body fingerprints

### Dedupe output

For each canonical story cluster, persist:

- canonical representative item
- duplicate member items
- merge rationale or match features

This is required so the sources drill-down can explain why 8 raw items became 5 canonical sources.

---

## 15. Failure modes

### Acceptable failure behavior

- ingestion failure for one source does not crash the entire run if enough sources remain
- failed weekly post does not delete generated digest artifacts
- malformed source items are logged and skipped
- missing previous digest disables compare output gracefully

### Must-alert failures

- zero sources ingested
- digest generation produces no ranked items
- Slack post fails after successful digest generation
- persisted schema validation fails

---

## 16. Security and secrets

### Requirements

- no secrets committed in repo
- Slack tokens must come from environment or secret manager
- source credentials must remain external to sample configs
- local artifact storage should be assumed single-operator by default

### Documentation requirements

The OSS repo must document:

- secret injection pattern
- least-privilege Slack setup
- local-only default behavior
- non-goal of multi-tenant isolation in v0.1

---

## 17. Evaluation plan

v0.1 needs basic regression checks even before advanced evaluation.

### Minimum evaluation dimensions

1. **Dedupe quality**  
   Are obvious duplicates collapsed without merging unrelated stories?

2. **Attribution quality**  
   Does every digest item resolve to concrete sources?

3. **Digest usefulness**  
   Are the top items plausibly the highest-value developments in the time window?

4. **Comparison quality**  
   Does the `Compare` action produce reasonable change-over-time summaries?

### Suggested MVP metrics

- raw item count vs canonical count
- source coverage by configured source
- digest item citation coverage
- percentage of digest items with at least one primary source
- Slack interaction usage by action type

---

## 18. Implementation roadmap

### v0.1

- repo scaffold
- config + schema files
- ingest pipeline for initial source types
- normalization and dedupe
- weekly digest generation
- Slack weekly post
- thread drill-down for expand, sources, compare

### v0.2

- improved clustering
- daily digest option
- topic history timeline
- better novelty detection
- static HTML report generation

### v0.3

- lightweight topic graph
- related-topic drill-down
- source curation tools
- stronger evaluation harness

### v1.0

- OSS packaging polish
- installation docs
- OpenClaw distribution path
- optional local report UI

---

## 19. First implementation tasks

### Task 1: Repository scaffold

Create monorepo structure and package boundaries.

### Task 2: Schema definitions

Implement:

- `config.schema.json`
- `normalized-item.schema.json`
- `digest-entry.schema.json`
- `topic-pack.schema.json`
- `weekly-digest.schema.json`

### Task 3: Sample configs

Create:

- `configs/profile.sample.yaml`
- `configs/sources.sample.yaml`
- `configs/slack.sample.yaml`

### Task 4: CLI skeleton

Implement commands:

- `ingest`
- `digest weekly`
- `slack post weekly`

### Task 5: Vertical slice

Prove the full path:

```text
sources.yaml -> ingest -> normalize -> dedupe -> rank -> weekly.md/json -> Slack post
```

That is the first milestone.

---

## 20. Open questions

These should be resolved before heavy implementation:

1. Which exact initial source set should ship in the sample config?
2. Which source types are mandatory in v0.1 beyond RSS?
3. Should Slack actions be interactive buttons immediately, or command-like thread replies first?
4. What level of evidence snippet extraction is feasible in the first cut?
5. Should the first OSS release include a static HTML report generator, or defer entirely?

---

## 21. Recommended immediate next files

After this spec, the next files to create are:

1. `schemas/config.schema.json`
2. `schemas/normalized-item.schema.json`
3. `configs/profile.sample.yaml`
4. `configs/sources.sample.yaml`
5. `packages/cli/src/index.ts`
6. `README.md`

---

## 22. Definition of done for v0.1

v0.1 is done when all of the following are true:

- a fresh repo clone can run the weekly digest from sample config
- the run produces markdown and JSON artifacts
- the digest posts to Slack successfully
- at least three drill-down actions work in Slack threads
- every digest item has traceable source references
- prior-week comparison works when a previous digest exists
- the repo includes installation and configuration documentation

---

## Appendix A: Example Monday workflow

1. Weekly ingest starts early Monday morning
2. Sources from the prior 7 days are collected
3. Items are normalized, deduped, scored, and clustered
4. Weekly digest artifacts are written to disk
5. Slack weekly digest is posted
6. User clicks `Expand` on a digest item
7. User clicks `Sources` to inspect evidence
8. User clicks `Compare` to inspect change from prior week

That workflow is the benchmark scenario for the MVP.
