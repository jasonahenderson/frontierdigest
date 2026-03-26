import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileStore } from "../../src/persist/file-store.js";
import type { Store } from "../../src/persist/index.js";
import { loadFixture } from "../helpers/fixtures.js";
import type {
  WeeklyDigest,
  DigestEntry,
  TopicPack,
  SourceBundle,
} from "../../src/types/index.js";
import { buildDigestBlocks } from "../../../slack/src/blocks/digest-post.js";
import { buildExpandBlocks } from "../../../slack/src/blocks/expand-reply.js";
import { buildSourcesBlocks } from "../../../slack/src/blocks/sources-reply.js";

let store: Store;
let tempDir: string;

const TEST_DATE = "2026-03-23";

let digest: WeeklyDigest;
let entries: DigestEntry[];
let topicPack: TopicPack;
let sourceBundle: SourceBundle;

describe("Persist round-trip through Slack formatter", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fd-persist-slack-"));
    store = new FileStore(tempDir);

    // Load fixtures
    digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    entries = await loadFixture<DigestEntry[]>("digest-entries.json");
    topicPack = await loadFixture<TopicPack>("topic-pack.json");
    sourceBundle = await loadFixture<SourceBundle>("source-bundle.json");

    // Persist all artifacts
    await store.saveDigest(TEST_DATE, digest, entries);
    await store.saveTopicPack(topicPack.topic_key, TEST_DATE, topicPack);
    await store.saveSourceBundle(sourceBundle.topic_key, TEST_DATE, sourceBundle);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("persist and retrieve digest, then format for Slack", async () => {
    const retrievedDigest = await store.getDigest(TEST_DATE);
    expect(retrievedDigest).not.toBeNull();
    expect(retrievedDigest!.id).toBe(digest.id);

    const retrievedEntries = await store.getDigestEntries(digest.id);
    expect(retrievedEntries.length).toBe(entries.length);

    // Format for Slack
    const blocks = buildDigestBlocks(retrievedDigest!, retrievedEntries);
    expect(blocks.length).toBeGreaterThan(0);

    const header = blocks[0] as { type: string; text: { text: string } };
    expect(header.type).toBe("header");
    expect(header.text.text).toContain("2026");
  });

  test("persist and retrieve topic pack, then format expand reply", async () => {
    const retrievedPack = await store.getTopicPack(topicPack.topic_key);
    expect(retrievedPack).not.toBeNull();
    expect(retrievedPack!.id).toBe(topicPack.id);
    expect(retrievedPack!.expanded_summary).toBe(topicPack.expanded_summary);

    const blocks = buildExpandBlocks(retrievedPack!);
    expect(blocks.length).toBeGreaterThan(0);

    const header = blocks[0] as { type: string; text: { text: string } };
    expect(header.type).toBe("header");
    expect(header.text.text).toBe(topicPack.title);

    // Should have sections for why_included, what_is_new, uncertainties
    const sections = blocks.filter((b) => b.type === "section");
    expect(sections.length).toBeGreaterThanOrEqual(3); // summary + why + what's new + uncertainties
  });

  test("persist and retrieve source bundle, then format sources reply", async () => {
    const bundleRef = `${sourceBundle.topic_key}/${TEST_DATE.replace(/-/g, "_")}`;
    const retrievedBundle = await store.getSourceBundle(bundleRef);
    expect(retrievedBundle).not.toBeNull();
    expect(retrievedBundle!.sources.length).toBe(sourceBundle.sources.length);

    const blocks = buildSourcesBlocks(retrievedBundle!);
    expect(blocks.length).toBeGreaterThan(0);

    const header = blocks[0] as { type: string; text: { text: string } };
    expect(header.type).toBe("header");
    expect(header.text.text).toContain(sourceBundle.topic_key);
  });

  test("full round-trip: all artifact data survives persist and retrieval", async () => {
    // Digest
    const d = await store.getDigest(TEST_DATE);
    expect(d!.summary).toBe(digest.summary);
    expect(d!.entries).toEqual(digest.entries);
    expect(d!.raw_item_count).toBe(digest.raw_item_count);

    // Entries
    const e = await store.getDigestEntries(digest.id);
    for (let i = 0; i < entries.length; i++) {
      expect(e[i].id).toBe(entries[i].id);
      expect(e[i].title).toBe(entries[i].title);
      expect(e[i].summary).toBe(entries[i].summary);
      expect(e[i].novelty_label).toBe(entries[i].novelty_label);
    }

    // Topic pack
    const tp = await store.getTopicPack(topicPack.topic_key);
    expect(tp!.why_included).toEqual(topicPack.why_included);
    expect(tp!.what_is_new).toEqual(topicPack.what_is_new);
    expect(tp!.uncertainties).toEqual(topicPack.uncertainties);

    // Source bundle
    const sb = await store.getSourceBundle(`${sourceBundle.topic_key}/${TEST_DATE.replace(/-/g, "_")}`);
    expect(sb!.sources.length).toBe(sourceBundle.sources.length);
    expect(sb!.sources[0].title).toBe(sourceBundle.sources[0].title);
  });

  test("topic history tracks multiple saves", async () => {
    const historyBefore = await store.getTopicHistory(topicPack.topic_key);
    const countBefore = historyBefore.length;

    // Save a second version
    const updatedPack: TopicPack = {
      ...topicPack,
      id: "topic-pack-v2",
      expanded_summary: "Updated summary for week 2",
    };
    await store.saveTopicPack(topicPack.topic_key, "2026-03-30", updatedPack);

    const historyAfter = await store.getTopicHistory(topicPack.topic_key);
    expect(historyAfter.length).toBeGreaterThan(countBefore);
  });
});
