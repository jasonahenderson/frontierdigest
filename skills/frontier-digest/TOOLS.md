# Frontier Digest Tools

## run-weekly
Run the full weekly digest pipeline.

### Arguments
- `--profile` (string, optional): Path to profile config. Default: `configs/profile.sample.yaml`
- `--sources` (string, optional): Path to sources config. Default: `configs/sources.sample.yaml`

### Command
`frontier-digest run weekly --profile {{profile}} --sources {{sources}}`

## ingest
Ingest sources for the current time window.

### Arguments
- `--profile` (string, optional): Path to profile config
- `--sources` (string, optional): Path to sources config

### Command
`frontier-digest ingest --profile {{profile}} --sources {{sources}}`

## post-to-slack
Post the latest weekly digest to Slack.

### Arguments
- `--profile` (string, optional): Path to profile config

### Command
`frontier-digest slack post weekly --profile {{profile}}`

## show-topic
Display details about a specific topic.

### Arguments
- `topic-id` (string, required): The topic identifier

### Command
`frontier-digest topic show {{topic-id}}`

## show-sources
Display sources for a specific topic.

### Arguments
- `topic-id` (string, required): The topic identifier

### Command
`frontier-digest topic sources {{topic-id}}`

## compare-weeks
Compare two weekly digests.

### Arguments
- `--current` (string, optional): Current digest date. Default: latest
- `--previous` (string, optional): Previous digest date. Default: previous

### Command
`frontier-digest diff weekly --current {{current}} --previous {{previous}}`

## validate-config
Validate configuration files.

### Arguments
- `--profile` (string, optional): Path to profile config
- `--sources` (string, optional): Path to sources config

### Command
`frontier-digest validate --profile {{profile}} --sources {{sources}}`

## list-digests
List available digests.

### Command
`frontier-digest list digests`

## inspect-run
Inspect a pipeline run.

### Arguments
- `run-id` (string, required): The run identifier

### Command
`frontier-digest inspect run {{run-id}}`
