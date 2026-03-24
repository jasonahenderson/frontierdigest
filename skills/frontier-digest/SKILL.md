# Frontier Digest

## Description
Frontier Digest is a weekly AI frontier research radar that ingests configured sources, synthesizes developments, and delivers a digest to Slack with drill-down capabilities.

## Capabilities
- Run weekly digest pipeline on demand
- Post digests to Slack channels
- Inspect topics, sources, and comparisons
- Validate configuration

## Usage

### Run the weekly digest
```
frontier-digest run weekly --profile configs/profile.sample.yaml --sources configs/sources.sample.yaml
```

### Post to Slack
```
frontier-digest slack post weekly --profile configs/profile.sample.yaml
```

### Inspect a topic
```
frontier-digest topic show <topic-id>
frontier-digest topic sources <topic-id>
```

### Compare weeks
```
frontier-digest diff weekly --current 2026-03-23 --previous 2026-03-16
```

## Schedule
Recommended: Run weekly on Monday mornings at 6:00 AM.

Example cron: `0 6 * * 1 frontier-digest run weekly`

## Requirements
- Bun runtime
- ANTHROPIC_API_KEY environment variable
- SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET for Slack delivery
- Configured source registry (configs/sources.sample.yaml)

## Outputs
- Markdown digest: data/digests/YYYY/MM/DD/weekly.md
- JSON digest: data/digests/YYYY/MM/DD/weekly.json
- Topic artifacts: data/topics/<topic-key>/
- Run manifests: data/runs/
