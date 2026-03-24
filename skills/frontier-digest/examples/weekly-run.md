# Weekly Digest Cron Setup

## Overview
This example shows how to schedule the weekly Frontier Digest pipeline via OpenClaw's cron system.

## Cron Definition
Schedule: Every Monday at 6:00 AM UTC

```yaml
schedule: "0 6 * * 1"
command: frontier-digest run weekly --profile configs/profile.yaml --sources configs/sources.yaml
on_success: frontier-digest slack post weekly --profile configs/profile.yaml
on_failure: notify --channel "#ops" --message "Frontier Digest weekly run failed"
```

## Manual Trigger
To run the digest outside the schedule:
```
frontier-digest run weekly
```

## Monitoring
Check the latest run:
```
frontier-digest inspect run latest
frontier-digest list digests --limit 5
```
