import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createStore } from "../../src/persist/index.js";
import type {
  NormalizedItem,
  DigestEntry,
  WeeklyDigest,
  TopicPack,
  SourceBundle,
  RunManifest,
} from "../../src/types/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

describe("FileStore", () => {
  let tmpDir: string;
  let store: ReturnType<typeof createStore>;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "fd-filestore-test-"));
    store = createStore(tmpDir);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("saveDigest / getDigest", () => {
    test("round-trips a weekly digest and entries", async () => {
      const digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
      const entries = await loadFixture<DigestEntry[]>("digest-entries.json");
      const date = "2026-03-23";

      await store.saveDigest(date, digest, entries);

      const retrieved = await store.getDigest(date);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(digest.id);
      expect(retrieved!.summary).toBe(digest.summary);
      expect(retrieved!.entries).toEqual(digest.entries);
      expect(retrieved!.raw_item_count).toBe(digest.raw_item_count);
    });

    test("getDigest returns null for non-existent date", async () => {
      const result = await store.getDigest("2099-01-01");
      expect(result).toBeNull();
    });
  });

  describe("getDigestEntries", () => {
    test("retrieves entries saved with saveDigest", async () => {
      const entries = await loadFixture<DigestEntry[]>("digest-entries.json");
      // Entries were saved in the previous test block with date 2026-03-23
      const digestId = "weekly_2026_03_23";
      const retrieved = await store.getDigestEntries(digestId);
      expect(retrieved).toHaveLength(entries.length);
      expect(retrieved[0].id).toBe(entries[0].id);
      expect(retrieved[0].title).toBe(entries[0].title);
    });

    test("returns empty array for non-existent digest ID", async () => {
      const retrieved = await store.getDigestEntries("weekly_2099_01_01");
      expect(retrieved).toEqual([]);
    });
  });

  describe("saveTopicPack / getTopicPack", () => {
    test("round-trips a topic pack", async () => {
      const pack = await loadFixture<TopicPack>("topic-pack.json");
      const topicKey = "topic-agent-memory";
      const date = "2026-03-23";

      await store.saveTopicPack(topicKey, date, pack);

      const retrieved = await store.getTopicPack(topicKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(pack.id);
      expect(retrieved!.title).toBe(pack.title);
      expect(retrieved!.expanded_summary).toBe(pack.expanded_summary);
      expect(retrieved!.why_included).toEqual(pack.why_included);
    });

    test("getTopicPack returns null for non-existent topic", async () => {
      const result = await store.getTopicPack("nonexistent-topic");
      expect(result).toBeNull();
    });
  });

  describe("getTopicHistory", () => {
    test("returns history array after saving a topic pack", async () => {
      const history = await store.getTopicHistory("topic-agent-memory");
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    test("returns empty array for non-existent topic", async () => {
      const history = await store.getTopicHistory("nonexistent-topic");
      expect(history).toEqual([]);
    });
  });

  describe("saveNormalizedItems / getNormalizedItems", () => {
    test("round-trips normalized items", async () => {
      const items = await loadFixture<NormalizedItem[]>("normalized-items.json");
      const date = "2026-03-23";

      await store.saveNormalizedItems(date, items);

      const retrieved = await store.getNormalizedItems(date);
      expect(retrieved).toHaveLength(items.length);
      expect(retrieved[0].id).toBe(items[0].id);
      expect(retrieved[0].title).toBe(items[0].title);
    });

    test("returns empty array for non-existent date", async () => {
      const result = await store.getNormalizedItems("2099-01-01");
      expect(result).toEqual([]);
    });
  });

  describe("saveRunManifest / getRunManifest", () => {
    test("round-trips a run manifest", async () => {
      const manifest: RunManifest = {
        id: "run-2026-03-23-test",
        started_at: "2026-03-23T06:00:00Z",
        completed_at: "2026-03-23T07:00:00Z",
        status: "completed",
        profile_snapshot: { profile: "test-profile" },
        steps: [
          {
            name: "ingest",
            status: "completed",
            started_at: "2026-03-23T06:00:00Z",
            completed_at: "2026-03-23T06:05:00Z",
            item_count: 10,
          },
          {
            name: "normalize",
            status: "completed",
            started_at: "2026-03-23T06:05:00Z",
            completed_at: "2026-03-23T06:06:00Z",
            item_count: 10,
          },
        ],
      };

      await store.saveRunManifest(manifest);

      const retrieved = await store.getRunManifest("run-2026-03-23-test");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(manifest.id);
      expect(retrieved!.status).toBe("completed");
      expect(retrieved!.steps).toHaveLength(2);
    });

    test("getRunManifest returns null for non-existent run", async () => {
      const result = await store.getRunManifest("nonexistent-run");
      expect(result).toBeNull();
    });
  });

  describe("saveRawItems", () => {
    test("saves raw items to correct path", async () => {
      const rawItems = [{ title: "Test" }, { title: "Test 2" }];
      await store.saveRawItems("2026-03-23", "test-source-1", rawItems);

      // Verify via filesystem
      const filePath = join(tmpDir, "raw", "2026", "03", "23", "test-source-1.json");
      const content = JSON.parse(await readFile(filePath, "utf-8"));
      expect(content).toHaveLength(2);
      expect(content[0].title).toBe("Test");
    });
  });

  describe("saveSourceBundle / getSourceBundle", () => {
    test("round-trips a source bundle via topic key path", async () => {
      const bundle = await loadFixture<SourceBundle>("source-bundle.json");

      await store.saveSourceBundle("topic-agent-memory", "2026-03-23", bundle);

      // getSourceBundle can take topicKey/slug format
      const retrieved = await store.getSourceBundle("topic-agent-memory/2026_03_23");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(bundle.id);
      expect(retrieved!.sources).toHaveLength(bundle.sources.length);
    });
  });

  describe("listDigests", () => {
    test("lists saved digests", async () => {
      const digests = await store.listDigests();
      expect(digests.length).toBeGreaterThanOrEqual(1);
      const found = digests.find((d) => d.date === "2026-03-23");
      expect(found).toBeTruthy();
      expect(found!.id).toBe("weekly_2026_03_23");
    });
  });

  describe("listRuns", () => {
    test("lists saved run manifests", async () => {
      const runs = await store.listRuns();
      expect(runs.length).toBeGreaterThanOrEqual(1);
      const found = runs.find((r) => r.id === "run-2026-03-23-test");
      expect(found).toBeTruthy();
      expect(found!.status).toBe("completed");
    });
  });

  describe("saveDigestMarkdown", () => {
    test("saves markdown to correct path", async () => {
      const markdown = "# Weekly Digest\n\nTest content.";
      await store.saveDigestMarkdown("2026-03-23", markdown);

      const filePath = join(tmpDir, "digests", "2026", "03", "23", "weekly.md");
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe(markdown);
    });
  });

  describe("getLatestDigest", () => {
    test("returns the most recent digest by date", async () => {
      const latest = await store.getLatestDigest();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe("weekly-digest-2026-03-23");
    });
  });
});
