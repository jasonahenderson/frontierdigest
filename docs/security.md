# Security

## Secrets Management

All secrets are passed via environment variables. No secrets are committed to the repository. Sample config files reference environment variable names, not values.

```yaml
# configs/slack.sample.yaml — references env var names, not tokens
slack:
  bot_token_env: SLACK_BOT_TOKEN
  signing_secret_env: SLACK_SIGNING_SECRET
  app_token_env: SLACK_APP_TOKEN
```

## Required Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes (for synthesis) | Authenticates with the Anthropic Messages API for LLM-based digest generation |
| `SLACK_BOT_TOKEN` | Yes (for Slack) | Bot User OAuth Token (`xoxb-...`) for posting messages and handling interactions |
| `SLACK_SIGNING_SECRET` | Yes (for Slack) | Verifies incoming requests from Slack |
| `SLACK_APP_TOKEN` | Optional | App-level token (`xapp-...`) for Socket Mode; omit to use HTTP mode |

Set these in your shell environment or a `.env` file (which must be in `.gitignore`).

## Least-Privilege Slack App Setup

The Slack app should be configured with the minimum permissions required:

1. **Bot Token Scopes**: `chat:write`, `channels:read`, `groups:read` -- nothing more.
2. **No user token scopes** are needed.
3. **Interactivity** must be enabled for button actions.
4. **Socket Mode** is recommended for development to avoid exposing a public HTTP endpoint.
5. Invite the bot only to the channel(s) it needs to post in.

Do not grant `admin`, `files:write`, `users:read`, or other broad scopes.

## Local-Only Default Behavior

By default, Frontier Digest operates entirely on the local machine:

- All artifacts are written to the local `data/` directory.
- No data is sent to external services other than:
  - RSS feed fetches (read-only HTTP GET requests to configured source URLs).
  - Anthropic API calls during synthesis (sends cluster data to generate summaries).
  - Slack API calls when posting digests or handling interactions.
- The system does not run a web server unless Slack HTTP mode is explicitly used.

## Data Storage Considerations

The persistence layer stores all pipeline artifacts (raw items, normalized items, digests, topic packs, source bundles, run manifests) as plain JSON files on disk.

**Single-operator assumption**: v0.1 assumes a single operator running the system. There is no access control on stored artifacts. Anyone with filesystem access to `data/` can read all collected content and generated summaries.

Sensitive information in stored artifacts:
- Source URLs and content from RSS feeds (publicly available information).
- LLM-generated summaries and analysis.
- Run metadata and configuration snapshots.

No user credentials, personal data, or proprietary content is stored unless the operator configures private RSS feeds.

## No Multi-Tenant Isolation

v0.1 does not support multi-tenant isolation:

- There is one global `data/` directory.
- There is no user authentication or authorization layer.
- There is no per-user or per-team data separation.
- The Slack bot posts to a single configured channel.

This is intentional for the MVP. Multi-tenancy is out of scope and should not be assumed by operators deploying this system.

## Prompt Injection Defenses

Frontier Digest processes untrusted RSS content and passes it to LLM providers. The following defenses are in place:

1. **Template variable isolation** — The prompt loader separates trusted variables (persona, focus from config) from untrusted variables (RSS content). Only trusted variables are substituted in the system prompt. Untrusted content is only placed in the user prompt section.

2. **Boundary markers** — All untrusted content is wrapped in `<source_data>` XML tags before being inserted into prompts. The LLM is instructed to treat content within these tags as external input data only.

3. **Template escaping** — Content containing `{{variable}}` patterns is escaped during normalization to prevent template injection. `{{` becomes `{ {` before reaching the prompt loader.

4. **Content sanitization** — RSS content goes through multiple sanitization steps:
   - HTML stripping via `sanitize-html` (replaces naive regex)
   - Control character and null byte removal
   - Template variable escaping
   - All applied during ingest and normalization, before any LLM interaction

5. **LLM output validation** — All synthesis functions validate LLM responses against Zod schemas using `safeParse`. Invalid responses are logged and rejected rather than passed downstream.

## Path Traversal Protection

1. **CLI path validation** — All `--domain`, `--profile`, `--sources`, and `--output` arguments are validated to ensure they resolve within the project directory. Paths containing `../` that escape the project root are rejected.

2. **Source ID sanitization** — Source IDs from config are sanitized before use in file paths, removing path traversal characters, slashes, and filesystem-unsafe characters.

3. **Topic key sanitization** — Topic keys are generated by stripping all non-alphanumeric characters (except hyphens), preventing path traversal through generated content.

4. **Date validation** — Date parameters used in persistence paths are strictly validated against `YYYY-MM-DD` format with range checks.

## Slack Output Security

1. **mrkdwn escaping** — All user-generated content (titles, summaries, excerpts) is escaped before insertion into Slack Block Kit blocks. HTML entities (`<`, `>`, `&`) are escaped to prevent link injection and user mention injection.

2. **URL validation** — URLs in source blocks are validated to start with `http://` or `https://`, preventing `javascript:` and `data:` URI injection.

3. **Action ID validation** — Slack interaction handlers validate action IDs against an alphanumeric pattern before using them as store keys, preventing injection via crafted button clicks.

## OpenClaw Security Considerations

When Frontier Digest is orchestrated by OpenClaw:

1. **No shell injection** — The CLI uses the `citty` framework which doesn't execute shell commands. OpenClaw invokes the CLI binary directly.

2. **Skill files are text-only** — `SKILL.md` and `TOOLS.md` contain no executable code, only command templates with `{{variable}}` placeholders.

3. **Path validation applies** — Even when OpenClaw passes arguments to the CLI, the path validation checks prevent directory traversal. OpenClaw should not pass user-provided strings directly to `--domain` or `--profile` without validation.

4. **Least privilege** — Run Frontier Digest with minimal filesystem permissions. The system only needs read access to `configs/` and write access to `data/`.

5. **Cron safety** — Scheduled runs via OpenClaw should use fixed config paths, not user-supplied ones.
