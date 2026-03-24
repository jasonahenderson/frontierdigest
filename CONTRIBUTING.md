# Contributing to Frontier Digest

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [pnpm](https://pnpm.io/) v8+
- [Node.js](https://nodejs.org/) v20+ (for pnpm)

### Setup

```bash
git clone https://github.com/jasonahenderson/frontierdigest.git
cd frontierdigest
pnpm install
```

### Verify your setup

```bash
bun test              # 138 tests, should all pass
pnpm run lint         # TypeScript type checking
```

## Development Workflow

1. **Fork** the repository and create a branch from `main`
2. **Make your changes** — keep commits focused and atomic
3. **Add tests** for new functionality
4. **Run the checks** before pushing:
   ```bash
   bun test              # All tests must pass
   pnpm run lint         # No type errors
   ```
5. **Open a pull request** with a clear description of what changed and why

## Project Layout

| Directory | What lives here |
|-----------|----------------|
| `packages/core/src/types/` | Zod schemas — the single source of truth for all types |
| `packages/core/src/ingest/` | Source fetchers (RSS, future: API, scrape) |
| `packages/core/src/normalize/` | URL canonicalization, content hashing, excerpts |
| `packages/core/src/dedupe/` | Title similarity, content fingerprinting, dedup logic |
| `packages/core/src/score/` | Relevance, recency, reinforcement scoring |
| `packages/core/src/cluster/` | Topic clustering heuristics |
| `packages/core/src/synthesize/` | LLM-driven synthesis (summaries, expansions, comparisons) |
| `packages/core/src/persist/` | File-based store abstraction |
| `packages/core/src/pipeline/` | End-to-end pipeline orchestrator |
| `packages/core/src/config/` | YAML config loading and validation |
| `packages/core/src/init/` | Interactive setup wizard logic |
| `packages/cli/src/commands/` | CLI command definitions (citty) |
| `packages/slack/src/` | Slack Block Kit formatting and Bolt interactions |
| `prompts/` | LLM prompt templates with `{{variable}}` placeholders |
| `configs/domains/` | Sample domain configurations |

## Code Conventions

### Types

All data contracts are defined as **Zod schemas** in `packages/core/src/types/`. TypeScript types are inferred from Zod using `z.infer<>`. Never define types separately from their schemas.

```typescript
// Correct
export const MySchema = z.object({ name: z.string() });
export type My = z.infer<typeof MySchema>;

// Wrong — don't hand-write types for data contracts
export interface My { name: string; }
```

### Imports

- Use `.js` extensions in import paths for ESM compatibility
- Import from barrel files where possible (`../types/index.js`)
- Cross-package imports use workspace names (`@frontier-digest/core`)

### LLM Boundaries

LLM calls are **only** made in `packages/core/src/synthesize/`. Every other module is deterministic or heuristic. This is intentional — it keeps testing simple and costs predictable.

### Prompt Templates

Prompts live in `prompts/` as Markdown files with `{{variable}}` placeholders. They use `{{persona}}` and `{{focus}}` for domain-specific context. Edit the templates directly — no code changes needed to adjust LLM behavior.

### Testing

- Tests use `bun:test` (Jest-compatible API)
- Test files live alongside source: `packages/core/test/`
- Fixtures are in `packages/core/test/fixtures/`
- LLM calls should be mocked in tests — never make real API calls

## Adding a New Source Type

The system currently supports RSS (`packages/core/src/ingest/rss.ts`). To add a new source type:

1. Create a fetcher in `packages/core/src/ingest/` (e.g., `api.ts`)
2. Return `RawItem[]` matching the interface in `packages/core/src/normalize/index.ts`
3. Register the type in the ingest orchestrator (`packages/core/src/ingest/index.ts`)
4. Add the type to the `SourceConfigSchema` enum in `packages/core/src/types/source-config.ts`
5. Add a test with fixture data

## Adding a New Domain Template

1. Create a YAML file in `configs/domains/`
2. Register it in `packages/core/src/init/templates.ts`
3. Test with `bun run packages/cli/src/index.ts init --template your-template`

## Reporting Issues

Open an issue on [GitHub](https://github.com/jasonahenderson/frontierdigest/issues) with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Bun version, Node version)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
