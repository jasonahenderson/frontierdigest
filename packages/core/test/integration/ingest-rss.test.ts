import { describe, test, expect, afterAll } from "bun:test";
import { fetchRss } from "../../src/ingest/rss.js";
import { ingest } from "../../src/ingest/index.js";
import type { SourceConfig, ProfileConfig } from "../../src/types/index.js";
import {
  startRssServer,
  generateRssXml,
  type RssServer,
} from "../helpers/mock-rss-server.js";

let server: RssServer;

// Build a date range that covers the fixture RSS feed dates (March 2026)
const windowStart = new Date("2026-03-01T00:00:00Z");
const windowEnd = new Date("2026-03-31T23:59:59Z");

afterAll(() => {
  server?.stop();
});

describe("Ingest RSS integration (local server)", () => {
  test("fetches and parses RSS feed from HTTP server", async () => {
    server = await startRssServer();

    const source: SourceConfig = {
      id: "test-source",
      type: "rss",
      name: "Test Source",
      url: `${server.url}/feed.xml`,
      weight: 1.0,
      tags: ["test"],
    };

    const items = await fetchRss(source, windowStart, windowEnd);

    expect(items.length).toBe(3);
    expect(items[0].title).toBe("Agent Memory Systems Paper");
    expect(items[1].title).toBe("Context Engineering for Production LLM Apps");
    expect(items[2].title).toBe("Evaluating Multi-Agent Coordination");
  });

  test("items include correct source metadata", async () => {
    server = await startRssServer();

    const source: SourceConfig = {
      id: "my-source-id",
      type: "rss",
      name: "My Source Name",
      url: `${server.url}/feed.xml`,
      weight: 0.9,
      tags: ["ai", "research"],
    };

    const items = await fetchRss(source, windowStart, windowEnd);

    for (const item of items) {
      expect(item.source_id).toBe("my-source-id");
      expect(item.source_name).toBe("My Source Name");
      expect(item.source_type).toBe("rss");
      expect(item.tags).toEqual(["ai", "research"]);
    }
  });

  test("respects date window filtering", async () => {
    server = await startRssServer();

    const source: SourceConfig = {
      id: "test-source",
      type: "rss",
      name: "Test Source",
      url: `${server.url}/feed.xml`,
      weight: 1.0,
      tags: [],
    };

    // Narrow window to only include the first item (March 18)
    const narrowStart = new Date("2026-03-18T00:00:00Z");
    const narrowEnd = new Date("2026-03-18T23:59:59Z");

    const items = await fetchRss(source, narrowStart, narrowEnd);

    expect(items.length).toBe(1);
    expect(items[0].title).toBe("Agent Memory Systems Paper");
  });

  test("returns empty array for 404 response", async () => {
    server = await startRssServer({ notFoundPaths: ["/missing.xml"] });

    const source: SourceConfig = {
      id: "test-source",
      type: "rss",
      name: "Missing Source",
      url: `${server.url}/missing.xml`,
      weight: 1.0,
      tags: [],
    };

    const items = await fetchRss(source, windowStart, windowEnd);
    expect(items).toEqual([]);
  });

  test("returns empty array for malformed XML", async () => {
    server = await startRssServer({ malformedPaths: ["/bad.xml"] });

    const source: SourceConfig = {
      id: "test-source",
      type: "rss",
      name: "Bad Source",
      url: `${server.url}/bad.xml`,
      weight: 1.0,
      tags: [],
    };

    const items = await fetchRss(source, windowStart, windowEnd);
    expect(items).toEqual([]);
  });

  test("strips HTML from descriptions", async () => {
    const htmlFeed = generateRssXml([
      {
        title: "HTML Test",
        link: "https://example.com/html-test",
        pubDate: "Wed, 18 Mar 2026 10:00:00 GMT",
        description:
          "<p>This is <strong>bold</strong> and <em>italic</em> text.</p>",
      },
    ]);

    server = await startRssServer({ feeds: { "/html-feed.xml": htmlFeed } });

    const source: SourceConfig = {
      id: "html-source",
      type: "rss",
      name: "HTML Source",
      url: `${server.url}/html-feed.xml`,
      weight: 1.0,
      tags: [],
    };

    const items = await fetchRss(source, windowStart, windowEnd);

    expect(items.length).toBe(1);
    expect(items[0].text).not.toContain("<p>");
    expect(items[0].text).not.toContain("<strong>");
    expect(items[0].text).not.toContain("<em>");
  });

  test("ingest aggregates from multiple sources", async () => {
    const feed1 = generateRssXml([
      {
        title: "Feed 1 Item",
        link: "https://example.com/feed1-1",
        pubDate: "Wed, 18 Mar 2026 10:00:00 GMT",
        description: "Item from feed 1",
      },
    ]);
    const feed2 = generateRssXml([
      {
        title: "Feed 2 Item",
        link: "https://example.com/feed2-1",
        pubDate: "Thu, 19 Mar 2026 10:00:00 GMT",
        description: "Item from feed 2",
      },
    ]);

    server = await startRssServer({
      feeds: { "/feed1.xml": feed1, "/feed2.xml": feed2 },
    });

    const sources: SourceConfig[] = [
      {
        id: "source-1",
        type: "rss",
        name: "Source One",
        url: `${server.url}/feed1.xml`,
        weight: 1.0,
        tags: ["s1"],
      },
      {
        id: "source-2",
        type: "rss",
        name: "Source Two",
        url: `${server.url}/feed2.xml`,
        weight: 0.8,
        tags: ["s2"],
      },
    ];

    const profile: ProfileConfig = {
      profile: "test",
      window: { weekly_lookback_days: 30 },
      interests: { include: ["test"], exclude: [] },
      ranking: {
        max_digest_items: 5,
        primary_source_bonus: 0.2,
        recency_weight: 0.25,
        relevance_weight: 0.25,
        source_weight: 0.25,
        reinforcement_weight: 0.25,
      },
      outputs: { root_dir: "./data/test", write_markdown: false, write_json: true },
    };

    const items = await ingest(profile, sources);

    expect(items.length).toBe(2);
    const ids = items.map((i) => i.source_id);
    expect(ids).toContain("source-1");
    expect(ids).toContain("source-2");
  });

  test("ingest handles one failing source gracefully", async () => {
    const goodFeed = generateRssXml([
      {
        title: "Good Item",
        link: "https://example.com/good",
        pubDate: "Wed, 18 Mar 2026 10:00:00 GMT",
        description: "Good feed item",
      },
    ]);

    server = await startRssServer({
      feeds: { "/good.xml": goodFeed },
      notFoundPaths: ["/bad.xml"],
    });

    const sources: SourceConfig[] = [
      {
        id: "good",
        type: "rss",
        name: "Good Source",
        url: `${server.url}/good.xml`,
        weight: 1.0,
        tags: [],
      },
      {
        id: "bad",
        type: "rss",
        name: "Bad Source",
        url: `${server.url}/bad.xml`,
        weight: 1.0,
        tags: [],
      },
    ];

    const profile: ProfileConfig = {
      profile: "test",
      window: { weekly_lookback_days: 30 },
      interests: { include: [], exclude: [] },
      ranking: {
        max_digest_items: 5,
        primary_source_bonus: 0.2,
        recency_weight: 0.25,
        relevance_weight: 0.25,
        source_weight: 0.25,
        reinforcement_weight: 0.25,
      },
      outputs: { root_dir: "./data/test", write_markdown: false, write_json: true },
    };

    const items = await ingest(profile, sources);

    // Should get items from good source, not throw
    expect(items.length).toBe(1);
    expect(items[0].source_id).toBe("good");
  });
});
