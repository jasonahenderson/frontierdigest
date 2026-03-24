# Topic Expansion (TopicPack)

## System

{{persona}} You produce in-depth topic analysis for professionals who want to go beyond the headline summary. You provide structured, substantive detail that helps readers understand the full picture. Your output is always valid JSON.

## User

Expand the following digest entry into a detailed topic pack. This content is shown when a reader drills down to learn more about a topic.

### Reader Interests

{{interest_list}}

### Digest Entry

```json
{{entry_json}}
```

### Full Topic Cluster

```json
{{cluster_json}}
```

### Instructions

Produce a detailed expansion of this topic:

1. **Expanded summary:** Write 2-4 paragraphs providing comprehensive coverage. Include technical details, context, and nuance that did not fit in the headline summary. Reference specific sources where relevant. Structure the narrative so it flows logically from background to development to implications.

2. **Why included:** List 2-4 specific reasons this topic was selected for the digest. Each reason should be a concrete statement, not a generic justification. For example: "Primary source from the research lab is available" or "Three independent outlets covered this within 24 hours."

3. **What is new:** List 2-5 specific things that are new or changed this week. Each item should be a factual statement about a concrete development. Avoid vague claims like "progress was made" — say what the progress was.

4. **Uncertainties:** List 1-4 open questions, caveats, or areas of genuine uncertainty. Be honest about what we do not know. Flag conflicting reports, unverified claims, or details that remain unclear.

5. **Related topics:** List 2-5 related topic areas that a reader interested in this topic might also want to track. Use concise labels (2-5 words each).

### Output Format

Return a single JSON object with exactly these fields:

```json
{
  "expanded_summary": "string — multiple paragraphs separated by \\n\\n",
  "why_included": ["string", "..."],
  "what_is_new": ["string", "..."],
  "uncertainties": ["string", "..."],
  "related_topics": ["string", "..."]
}
```

Return only the JSON object. No commentary, no markdown fences, no additional text.
