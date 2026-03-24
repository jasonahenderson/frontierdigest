import type {
  NormalizedItem,
  DigestEntry,
  WeeklyDigest,
  TopicPack,
  SourceBundle,
  RunManifest,
} from "../types/index.js";

export interface Store {
  // Write operations
  saveRawItems(date: string, sourceId: string, items: unknown[]): Promise<void>;
  saveNormalizedItems(date: string, items: NormalizedItem[]): Promise<void>;
  saveDigest(
    date: string,
    digest: WeeklyDigest,
    entries: DigestEntry[],
  ): Promise<void>;
  saveTopicPack(
    topicKey: string,
    date: string,
    pack: TopicPack,
  ): Promise<void>;
  saveSourceBundle(
    topicKey: string,
    date: string,
    bundle: SourceBundle,
  ): Promise<void>;
  saveRunManifest(manifest: RunManifest): Promise<void>;
  saveDigestMarkdown(date: string, markdown: string): Promise<void>;

  // Read operations
  getLatestDigest(): Promise<WeeklyDigest | null>;
  getDigest(date: string): Promise<WeeklyDigest | null>;
  getDigestEntries(digestId: string): Promise<DigestEntry[]>;
  getTopicPack(topicKey: string): Promise<TopicPack | null>;
  getTopicHistory(topicKey: string): Promise<TopicPack[]>;
  getSourceBundle(ref: string): Promise<SourceBundle | null>;
  getNormalizedItems(date: string): Promise<NormalizedItem[]>;
  getRunManifest(runId: string): Promise<RunManifest | null>;
  listDigests(): Promise<Array<{ date: string; id: string }>>;
  listRuns(): Promise<Array<{ id: string; date: string; status: string }>>;
}

import { FileStore } from "./file-store.js";

export { FileStore };

export function createStore(rootDir: string): Store {
  return new FileStore(rootDir);
}
