import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildDigestBlocks } from "../src/blocks/digest-post.js";
import { formatDate, pluralize, truncate } from "../src/formatter.js";
import type { WeeklyDigest, DigestEntry } from "@frontier-digest/core";

const CORE_FIXTURES_DIR = join(import.meta.dir, "..", "..", "core", "test", "fixtures");

async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(CORE_FIXTURES_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

describe("Slack formatter utilities", () => {
  describe("truncate", () => {
    test("returns text unchanged if within limit", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    test("truncates long text with ellipsis character", () => {
      const long = "a".repeat(100);
      const result = truncate(long, 50);
      expect(result.length).toBe(50);
      expect(result.endsWith("\u2026")).toBe(true);
    });

    test("handles exact-length text", () => {
      const text = "12345";
      expect(truncate(text, 5)).toBe("12345");
    });
  });

  describe("formatDate", () => {
    test("formats ISO date string as human-readable date", () => {
      const result = formatDate("2026-03-23T07:00:00Z");
      expect(result).toContain("March");
      expect(result).toContain("23");
      expect(result).toContain("2026");
    });

    test("handles different months correctly", () => {
      const result = formatDate("2026-01-15T00:00:00Z");
      expect(result).toContain("January");
      expect(result).toContain("15");
    });
  });

  describe("pluralize", () => {
    test("returns singular for count 1", () => {
      expect(pluralize(1, "theme")).toBe("theme");
    });

    test("returns plural (default s suffix) for count != 1", () => {
      expect(pluralize(0, "theme")).toBe("themes");
      expect(pluralize(2, "theme")).toBe("themes");
      expect(pluralize(5, "theme")).toBe("themes");
    });

    test("uses custom plural form when provided", () => {
      expect(pluralize(2, "category", "categories")).toBe("categories");
    });
  });
});

describe("buildDigestBlocks", () => {
  let digest: WeeklyDigest;
  let entries: DigestEntry[];

  test("loads fixture data", async () => {
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");
    expect(digest).toBeTruthy();
    expect(entries.length).toBeGreaterThan(0);
  });

  test("returns a non-empty blocks array", async () => {
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");

    const blocks = buildDigestBlocks(digest, entries);
    expect(blocks.length).toBeGreaterThan(0);
  });

  test("first block is a header containing the date", async () => {
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");

    const blocks = buildDigestBlocks(digest, entries);
    const header = blocks[0] as { type: string; text: { text: string } };
    expect(header.type).toBe("header");
    expect(header.text.text).toContain("March");
    expect(header.text.text).toContain("2026");
  });

  test("second block contains coverage stats", async () => {
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");

    const blocks = buildDigestBlocks(digest, entries);
    const section = blocks[1] as { type: string; text: { text: string } };
    expect(section.type).toBe("section");
    expect(section.text.text).toContain("Coverage");
    expect(section.text.text).toContain(String(digest.raw_item_count));
  });

  test("includes action blocks with correct action_ids for each entry", async () => {
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");

    const blocks = buildDigestBlocks(digest, entries);

    const actionBlocks = blocks.filter((b) => b.type === "actions");
    expect(actionBlocks.length).toBe(entries.length);

    for (let i = 0; i < entries.length; i++) {
      const action = actionBlocks[i] as {
        type: string;
        elements: Array<{ action_id: string; text: { text: string } }>;
      };
      const entryId = entries[i].id;

      expect(action.elements).toHaveLength(3);

      // Expand button
      expect(action.elements[0].action_id).toBe(`expand:${entryId}`);
      expect(action.elements[0].text.text).toBe("Expand");

      // Sources button
      expect(action.elements[1].action_id).toBe(`sources:${entryId}`);
      expect(action.elements[1].text.text).toBe("Sources");

      // Compare button
      expect(action.elements[2].action_id).toBe(`compare:${entryId}`);
      expect(action.elements[2].text.text).toBe("Compare");
    }
  });

  test("includes dividers between entries but not after the last one", async () => {
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");

    const blocks = buildDigestBlocks(digest, entries);

    // After the initial header, stats, and divider, there are entries.
    // Between each entry pair there should be a divider.
    // Count total dividers: 1 (after header/stats) + (entries.length - 1) between entries
    const dividers = blocks.filter((b) => b.type === "divider");
    const expectedDividers = 1 + (entries.length - 1);
    expect(dividers.length).toBe(expectedDividers);

    // Last block should NOT be a divider
    expect(blocks[blocks.length - 1].type).not.toBe("divider");
  });

  test("entry sections contain title, summary, and metadata", async () => {
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");

    const blocks = buildDigestBlocks(digest, entries);

    const sectionBlocks = blocks.filter(
      (b) => b.type === "section" && b !== blocks[1],
    ) as Array<{ type: string; text: { text: string } }>;

    // One section block per entry
    expect(sectionBlocks.length).toBe(entries.length);

    for (let i = 0; i < entries.length; i++) {
      const section = sectionBlocks[i];
      expect(section.text.text).toContain(entries[i].title);
      expect(section.text.text).toContain("Sources:");
      expect(section.text.text).toContain("Novelty:");
    }
  });
});
