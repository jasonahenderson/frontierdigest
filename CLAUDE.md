# Frontier Digest — Claude Code Instructions

## Activity Logging

Every chat session MUST log activity to `history/activity/`.

- **File format:** `history/activity/YYYY-MM-DD-<short-slug>.md`
- **When:** At the end of each session, or when the user asks to commit
- **Content:** Markdown summary including:
  - Date and session timestamp
  - What was discussed and/or built
  - Key decisions made
  - Files created or changed
  - Next steps (if applicable)

## Project Overview

Frontier Digest is a weekly AI frontier digest system. See `docs/tech-spec.md` for the full specification.

- **Runtime:** TypeScript + Bun
- **Monorepo:** pnpm workspaces
- **Packages:** `packages/core`, `packages/cli`, `packages/slack`
- **Key libraries:** Zod (validation), citty (CLI), @slack/bolt (Slack), @anthropic-ai/sdk (LLM), consola (logging)

## Development

```bash
pnpm install          # install dependencies
bun test              # run tests
bun run packages/cli/src/index.ts  # run CLI
```

## Architecture

- All types are defined as Zod schemas in `packages/core/src/types/` — TypeScript types are inferred from Zod
- LLM calls are isolated to `packages/core/src/synthesize/` — everything else is deterministic/heuristic
- Slack drill-down reads pre-generated artifacts from the Store, never triggers LLM calls
- Prompt templates live in `prompts/` as Markdown with `{{variable}}` placeholders
