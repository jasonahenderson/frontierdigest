# Slack Interaction Contract

## Slack App Permissions

The bot requires these OAuth scopes:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Post digest messages and thread replies |
| `channels:read` | Resolve channel names to IDs (public channels) |
| `groups:read` | Resolve channel names to IDs (private channels) |

Interactivity must be enabled in the Slack app configuration so that button clicks are routed to the bot.

## Socket Mode vs HTTP Mode

The Slack package supports both modes. The mode is determined automatically based on configuration:

- **Socket Mode** (recommended for development): Set `SLACK_APP_TOKEN` (an `xapp-...` token). The bot connects via WebSocket -- no public URL needed.
- **HTTP Mode**: Omit `SLACK_APP_TOKEN`. The bot listens on an HTTP endpoint. Requires a publicly reachable URL configured as the Slack app's Request URL.

Configuration in `configs/slack.sample.yaml`:

```yaml
slack:
  bot_token_env: SLACK_BOT_TOKEN
  signing_secret_env: SLACK_SIGNING_SECRET
  app_token_env: SLACK_APP_TOKEN       # optional; enables socket mode
  channel: "#ai-radar"
  post_threads: true
```

## Weekly Post Format

The weekly digest is posted as a Block Kit message with this structure:

```
+----------------------------------------------------------+
| [header] Weekly AI Frontier Digest -- 2026-03-23         |
+----------------------------------------------------------+
| [section] Coverage: 148 items -> 41 canonical -> 8 top   |
|           Change vs last week: 3 new, 2 accel, 1 cool   |
+----------------------------------------------------------+
| [divider]                                                |
+----------------------------------------------------------+
| [section] *1. Topic title*                               |
|           Summary text (truncated to 300 chars)          |
|           Sources: 6 | Primary: 3 | Novelty | Confidence|
+----------------------------------------------------------+
| [actions] [Expand] [Sources] [Compare]                   |
+----------------------------------------------------------+
| [divider]                                                |
+----------------------------------------------------------+
| [section] *2. Topic title*                               |
|           ...                                            |
+----------------------------------------------------------+
| [actions] [Expand] [Sources] [Compare]                   |
+----------------------------------------------------------+
```

Block types used:
- `header` -- Digest title with date
- `section` (mrkdwn) -- Coverage stats, and one section per entry
- `actions` -- Three buttons per entry
- `divider` -- Between entries

## Per-Item Action Buttons

Each digest entry has three buttons:

| Button | Action | Description |
|--------|--------|-------------|
| Expand | `expand:<entry-id>` | Shows expanded summary, why included, what is new, uncertainties |
| Sources | `sources:<entry-id>` | Shows source list with primary/secondary labels and evidence snippets |
| Compare | `compare:<entry-id>` | Shows previous vs current framing, detected shifts, trend interpretation |

All buttons respond as thread replies (`replace_original: false`), keeping the main post intact.

## Action ID Encoding

Action IDs follow the pattern `<action>:<entry-id>`:

```
expand:entry-a1b2c3d4-...
sources:entry-a1b2c3d4-...
compare:entry-a1b2c3d4-...
```

The interaction handler uses regex matching (`/^expand:/`, `/^sources:/`, `/^compare:/`) to route actions. The entry ID is extracted by stripping the prefix.

## Thread Reply Formats

### Expand Reply

Returned when the user clicks "Expand". Reads the `TopicPack` from the Store.

```
*Topic Title*

_Expanded Summary_
Full multi-paragraph synthesis of the topic.

*Why Included*
- Reason 1
- Reason 2

*What Is New*
- Development 1
- Development 2

*Uncertainties*
- Open question 1
```

### Sources Reply

Returned when the user clicks "Sources". Reads the `SourceBundle` from the Store.

```
*Sources for: topic-key*

1. *Source Title* (primary)
   URL | Excerpt snippet

2. *Source Title* (secondary)
   URL | Excerpt snippet

Dedupe notes: X raw items -> Y canonical sources
```

### Compare Reply

Returned when the user clicks "Compare". Reads the topic history from the Store and compares the two most recent entries.

```
*Comparison: Topic Title*

*Previous Week*
Prior period framing text.

*This Week*
Current period framing text.

*Detected Shifts*
- Shift 1
- Shift 2

*Trend Interpretation*
Analysis of the trajectory.
```

If no previous week data exists, the handler responds with: "No previous week data available for comparison."

## Error Handling

All three interaction handlers follow the same error pattern:

1. Immediately `ack()` the action to satisfy Slack's 3-second requirement.
2. Attempt to load the artifact from the Store.
3. If the artifact is missing or the load throws, respond with: "Data not available for this topic."

Errors are non-fatal to the Slack app -- a failed drill-down for one entry does not affect others.
