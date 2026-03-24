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
