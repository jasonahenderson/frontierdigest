import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

export interface RssServerOptions {
  /** Map of URL paths to XML content. Defaults to { "/feed.xml": rss-feed.xml fixture } */
  feeds?: Record<string, string>;
  /** Paths that should return 404 */
  notFoundPaths?: string[];
  /** Paths that should return malformed XML */
  malformedPaths?: string[];
  /** Paths that should hang (simulate timeout) */
  timeoutPaths?: string[];
}

export interface RssServer {
  url: string;
  port: number;
  stop: () => void;
}

/**
 * Start a local HTTP server that serves RSS feed fixtures.
 */
export async function startRssServer(
  options?: RssServerOptions,
): Promise<RssServer> {
  const defaultXml = await readFile(join(FIXTURES_DIR, "rss-feed.xml"), "utf-8");
  const feeds = options?.feeds ?? { "/feed.xml": defaultXml };
  const notFoundPaths = new Set(options?.notFoundPaths ?? []);
  const malformedPaths = new Set(options?.malformedPaths ?? []);
  const timeoutPaths = new Set(options?.timeoutPaths ?? []);

  const server = Bun.serve({
    port: 0, // random available port
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (notFoundPaths.has(path)) {
        return new Response("Not Found", { status: 404 });
      }

      if (malformedPaths.has(path)) {
        return new Response("<<<not xml at all!!!", {
          headers: { "Content-Type": "application/xml" },
        });
      }

      if (timeoutPaths.has(path)) {
        // Return a response that never resolves (within test timeout)
        return new Promise<Response>(() => {});
      }

      const content = feeds[path];
      if (content) {
        return new Response(content, {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  return {
    url: `http://localhost:${server.port}`,
    port: server.port,
    stop: () => server.stop(),
  };
}

/**
 * Generate an RSS XML string with custom items for testing.
 */
export function generateRssXml(
  items: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
  }>,
  feedTitle = "Test Feed",
): string {
  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <pubDate>${item.pubDate}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>https://example.com</link>
    <description>Generated test feed</description>
${itemsXml}
  </channel>
</rss>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
