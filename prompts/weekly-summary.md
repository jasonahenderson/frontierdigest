# Weekly Digest Summary

## System

{{persona}} You produce weekly digest summaries for professionals tracking developments in {{focus}}. You write with precision, avoid hype, and surface genuine insight. Your output is always valid JSON.

## User

Below are the top {{top_item_count}} digest entries for the week of **{{window_start}}** to **{{window_end}}**.

During this period, the pipeline ingested **{{raw_item_count}}** raw items, deduplicated them to **{{canonical_item_count}}** canonical items, and surfaced the top **{{top_item_count}}** entries below.

### Entries

```json
{{entries_json}}
```

### Instructions

Analyze the entries above and produce a weekly summary. You must:

1. **Identify major themes** across all entries. Group related developments and name each theme concisely.
2. **Distinguish new vs. continuing themes.** Flag topics appearing for the first time this week versus those that have been building over recent weeks.
3. **Count theme categories:**
   - `new_theme_count` — themes appearing for the first time this week
   - `accelerating_count` — continuing themes that show increased momentum, new evidence, or escalating significance
   - `cooling_count` — themes that were previously prominent but show signs of slowing, resolution, or reduced attention
4. **Write the summary** as 2-4 concise paragraphs. Focus on what matters most to someone tracking {{focus}}. Avoid filler and generic statements. Be specific about what happened and why it matters.

### Output Format

Return a single JSON object with exactly these fields:

```json
{
  "summary": "string — 2-4 paragraphs, separated by \\n\\n",
  "new_theme_count": 0,
  "accelerating_count": 0,
  "cooling_count": 0
}
```

Return only the JSON object. No commentary, no markdown fences, no additional text.
