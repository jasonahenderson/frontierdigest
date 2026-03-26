import type {
  NormalizedItem,
  DigestEntry,
  WeeklyDigest,
  TopicPack,
  SourceBundle,
  RunManifest,
} from "../../src/types/index.js";
import type { Store } from "../../src/persist/index.js";

/**
 * In-memory implementation of the Store interface for testing.
 * Stores everything in Maps for fast, filesystem-free tests.
 */
export function createMockStore(): Store & {
  getData(): Map<string, unknown>;
  getCallLog(): Array<{ method: string; args: unknown[] }>;
} {
  const data = new Map<string, unknown>();
  const callLog: Array<{ method: string; args: unknown[] }> = [];

  function log(method: string, ...args: unknown[]) {
    callLog.push({ method, args });
  }

  return {
    getData: () => data,
    getCallLog: () => callLog,

    async saveRawItems(date: string, sourceId: string, items: unknown[]) {
      log("saveRawItems", date, sourceId, items);
      data.set(`raw/${date}/${sourceId}`, items);
    },

    async saveNormalizedItems(date: string, items: NormalizedItem[]) {
      log("saveNormalizedItems", date, items);
      data.set(`normalized/${date}`, items);
    },

    async saveDigest(date: string, digest: WeeklyDigest, entries: DigestEntry[]) {
      log("saveDigest", date, digest, entries);
      data.set(`digest/${date}/weekly`, digest);
      data.set(`digest/${date}/entries`, entries);
      // Also save as latest
      data.set("digest/latest", { date, digest });
    },

    async saveTopicPack(topicKey: string, date: string, pack: TopicPack) {
      log("saveTopicPack", topicKey, date, pack);
      data.set(`topic/${topicKey}/latest`, pack);
      // Append to history
      const historyKey = `topic/${topicKey}/history`;
      const history = (data.get(historyKey) as TopicPack[]) ?? [];
      history.push(pack);
      data.set(historyKey, history);
    },

    async saveSourceBundle(topicKey: string, date: string, bundle: SourceBundle) {
      log("saveSourceBundle", topicKey, date, bundle);
      data.set(`topic/${topicKey}/sources/${date}`, bundle);
      data.set(`source-bundle/${bundle.id}`, bundle);
    },

    async saveRunManifest(manifest: RunManifest) {
      log("saveRunManifest", manifest);
      data.set(`runs/${manifest.id}`, manifest);
    },

    async saveDigestMarkdown(date: string, markdown: string) {
      log("saveDigestMarkdown", date, markdown);
      data.set(`digest/${date}/markdown`, markdown);
    },

    async getLatestDigest(): Promise<WeeklyDigest | null> {
      log("getLatestDigest");
      const latest = data.get("digest/latest") as { date: string; digest: WeeklyDigest } | undefined;
      return latest?.digest ?? null;
    },

    async getDigest(date: string): Promise<WeeklyDigest | null> {
      log("getDigest", date);
      return (data.get(`digest/${date}/weekly`) as WeeklyDigest) ?? null;
    },

    async getDigestEntries(digestId: string): Promise<DigestEntry[]> {
      log("getDigestEntries", digestId);
      // Search all entries to find matching digest
      for (const [key, value] of data) {
        if (key.endsWith("/entries")) {
          const entries = value as DigestEntry[];
          // Return entries associated with the digest
          const digestKey = key.replace("/entries", "/weekly");
          const digest = data.get(digestKey) as WeeklyDigest | undefined;
          if (digest?.id === digestId) {
            return entries;
          }
        }
      }
      return [];
    },

    async getTopicPack(topicKey: string): Promise<TopicPack | null> {
      log("getTopicPack", topicKey);
      return (data.get(`topic/${topicKey}/latest`) as TopicPack) ?? null;
    },

    async getTopicHistory(topicKey: string): Promise<TopicPack[]> {
      log("getTopicHistory", topicKey);
      return (data.get(`topic/${topicKey}/history`) as TopicPack[]) ?? [];
    },

    async getSourceBundle(ref: string): Promise<SourceBundle | null> {
      log("getSourceBundle", ref);
      return (data.get(`source-bundle/${ref}`) as SourceBundle) ?? null;
    },

    async getNormalizedItems(date: string): Promise<NormalizedItem[]> {
      log("getNormalizedItems", date);
      return (data.get(`normalized/${date}`) as NormalizedItem[]) ?? [];
    },

    async getRunManifest(runId: string): Promise<RunManifest | null> {
      log("getRunManifest", runId);
      return (data.get(`runs/${runId}`) as RunManifest) ?? null;
    },

    async listDigests(): Promise<Array<{ date: string; id: string }>> {
      log("listDigests");
      const results: Array<{ date: string; id: string }> = [];
      for (const [key, value] of data) {
        if (key.match(/^digest\/\d{4}-\d{2}-\d{2}\/weekly$/)) {
          const digest = value as WeeklyDigest;
          const date = key.split("/")[1];
          results.push({ date, id: digest.id });
        }
      }
      return results;
    },

    async listRuns(): Promise<Array<{ id: string; date: string; status: string }>> {
      log("listRuns");
      const results: Array<{ id: string; date: string; status: string }> = [];
      for (const [key, value] of data) {
        if (key.startsWith("runs/")) {
          const manifest = value as RunManifest;
          results.push({
            id: manifest.id,
            date: manifest.started_at,
            status: manifest.status,
          });
        }
      }
      return results;
    },
  };
}
