import consola from "consola";
import { DomainConfigSchema, type DomainConfig, type LLMConfig } from "../types/index.js";
import { llmGenerate } from "../synthesize/llm.js";

export { listTemplates, getTemplatePath } from "./templates.js";

export interface InitInput {
  topicDescription: string;
  slackChannel?: string;
  slackEnabled?: boolean;
}

export interface InitResult {
  domainConfig: DomainConfig;
  suggestedFilename: string;
}

const SYSTEM_PROMPT = `You are a configuration generator for Frontier Digest, a research radar system.
Given a topic description, generate a complete domain configuration.

You must return a valid JSON object matching this structure:
{
  "domain": {
    "id": "lowercase-hyphenated-id",
    "name": "Human Readable Name",
    "description": "Brief description",
    "prompt_context": {
      "persona": "You are a [domain] research analyst tracking...",
      "focus": "brief focus description"
    },
    "profile": {
      "window": { "weekly_lookback_days": 7 },
      "interests": {
        "include": ["specific interest 1", "specific interest 2"],
        "exclude": ["things to filter out"]
      },
      "ranking": {
        "max_digest_items": 8,
        "primary_source_bonus": 0.2,
        "recency_weight": 0.2,
        "relevance_weight": 0.4,
        "source_weight": 0.2,
        "reinforcement_weight": 0.2
      },
      "outputs": {
        "root_dir": "./data",
        "write_markdown": true,
        "write_json": true
      }
    },
    "sources": [
      {
        "id": "source-id",
        "type": "rss",
        "name": "Source Name",
        "url": "https://actual-rss-feed-url",
        "weight": 1.0,
        "tags": ["tag1", "tag2"]
      }
    ],
    "slack": {
      "enabled": false,
      "channel": "#channel-name",
      "post_threads": true
    }
  }
}

For sources, suggest REAL RSS feed URLs. Good sources include:
- arXiv RSS feeds (e.g., http://export.arxiv.org/rss/cs.AI)
- Research lab blogs with RSS
- Topic-specific newsletters with feeds
- Subreddit RSS feeds (e.g., https://www.reddit.com/r/topic/.rss)

Be specific with interests — include 6-10 include topics and 3-5 exclude topics.
Return ONLY valid JSON, no markdown fences.`;

export async function generateDomainConfig(
  input: InitInput,
  llmConfig?: LLMConfig,
): Promise<InitResult> {
  const slackNote = input.slackEnabled
    ? `The user wants Slack notifications in channel "${input.slackChannel ?? "#digest"}". Set slack.enabled to true and slack.channel to "${input.slackChannel ?? "#digest"}".`
    : "Set slack.enabled to false.";

  const userPrompt = `Generate a domain configuration for tracking: ${input.topicDescription}\n\n${slackNote}`;

  consola.debug("Calling LLM to generate domain config...");

  const raw = await llmGenerate(SYSTEM_PROMPT, userPrompt, {
    maxTokens: 4096,
    temperature: 0.4,
    llmConfig,
  });

  // Strip markdown fences if the LLM included them despite instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    consola.error("LLM returned invalid JSON. Raw response:", raw);
    throw new Error("Failed to parse LLM response as JSON");
  }

  const validated = DomainConfigSchema.parse(parsed);

  const suggestedFilename = `${validated.domain.id}.yaml`;

  return {
    domainConfig: validated,
    suggestedFilename,
  };
}
