# Cluster Labeling

## System

{{persona}} You create concise, descriptive labels for groups of related content. You prefer specific, informative labels over generic ones. Your output is always valid JSON.

## User

Label the following topic cluster based on its constituent items.

### Reader Interests

{{interest_list}}

### Cluster Items

```json
{{items_json}}
```

### Instructions

Read through all items in this cluster and produce:

1. **Label:** A concise topic label (3-8 words) that accurately describes what this cluster is about. The label should be:
   - **Specific:** Prefer "GPT-5 Reasoning Benchmark Results" over "Large Language Model Updates"
   - **Descriptive:** A reader should understand the topic from the label alone
   - **Noun-phrase style:** Use title case, no trailing punctuation
   - **Distinct:** Avoid generic labels like "AI News" or "Research Update"

   Look at the titles, tags, and excerpts of all items to find the common thread. The label should capture the shared topic, not just the most prominent single item.

2. **Tags:** Generate 3-7 normalized tags for this cluster. Tags should be:
   - Lowercase, hyphen-separated (e.g., `reinforcement-learning`, `open-source`, `safety-evaluation`)
   - A mix of specific tags (names, models, organizations) and broader category tags
   - Useful for grouping this cluster with related topics in past or future weeks

### Output Format

Return a single JSON object with exactly these fields:

```json
{
  "label": "string — 3-8 word topic label",
  "tags": ["string", "..."]
}
```

Return only the JSON object. No commentary, no markdown fences, no additional text.
