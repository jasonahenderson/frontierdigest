import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { sanitizePathComponent } from "../sanitize/index.js";
import type {
  NormalizedItem,
  DigestEntry,
  WeeklyDigest,
  TopicPack,
  SourceBundle,
  RunManifest,
} from "../types/index.js";
import type { Store } from "./index.js";
import {
  rawDir,
  normalizedDir,
  digestDir,
  topicDir,
  topicSourcesDir,
  runsDir,
} from "./paths.js";

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(join(filePath, ".."));
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const s = await stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export class FileStore implements Store {
  constructor(private readonly rootDir: string) {}

  // ── Write operations ──────────────────────────────────────────────

  async saveRawItems(
    date: string,
    sourceId: string,
    items: unknown[],
  ): Promise<void> {
    const safeSourceId = sanitizePathComponent(sourceId);
    const dir = rawDir(this.rootDir, date);
    await ensureDir(dir);
    await writeJson(join(dir, `${safeSourceId}.json`), items);
  }

  async saveNormalizedItems(
    date: string,
    items: NormalizedItem[],
  ): Promise<void> {
    const dir = normalizedDir(this.rootDir, date);
    await ensureDir(dir);
    await writeJson(join(dir, "items.json"), items);
  }

  async saveDigest(
    date: string,
    digest: WeeklyDigest,
    entries: DigestEntry[],
  ): Promise<void> {
    const dir = digestDir(this.rootDir, date);
    await ensureDir(dir);
    await Promise.all([
      writeJson(join(dir, "weekly.json"), digest),
      writeJson(join(dir, "entries.json"), entries),
    ]);
  }

  async saveTopicPack(
    topicKey: string,
    date: string,
    pack: TopicPack,
  ): Promise<void> {
    const dir = topicDir(this.rootDir, topicKey);
    await ensureDir(dir);

    // Write the latest snapshot
    await writeJson(join(dir, "latest.json"), pack);

    // Append to history
    const historyPath = join(dir, "history.json");
    const existing = (await readJson<TopicPack[]>(historyPath)) ?? [];
    existing.push(pack);
    await writeJson(historyPath, existing);

    // Also write a date-stamped version
    const slug = date.replace(/-/g, "_");
    await writeJson(join(dir, `${slug}.json`), pack);
  }

  async saveSourceBundle(
    topicKey: string,
    date: string,
    bundle: SourceBundle,
  ): Promise<void> {
    const dir = topicSourcesDir(this.rootDir, topicKey);
    await ensureDir(dir);
    const slug = date.replace(/-/g, "_");
    await writeJson(join(dir, `${slug}.json`), bundle);
  }

  async saveRunManifest(manifest: RunManifest): Promise<void> {
    const dir = runsDir(this.rootDir);
    await ensureDir(dir);
    await writeJson(join(dir, `${manifest.id}.json`), manifest);
  }

  async saveDigestMarkdown(date: string, markdown: string): Promise<void> {
    const dir = digestDir(this.rootDir, date);
    await ensureDir(dir);
    await writeFile(join(dir, "weekly.md"), markdown, "utf-8");
  }

  // ── Read operations ───────────────────────────────────────────────

  async getLatestDigest(): Promise<WeeklyDigest | null> {
    const dates = await this.scanDigestDates();
    if (dates.length === 0) return null;
    // Dates are YYYY-MM-DD strings; lexicographic sort gives chronological order
    dates.sort();
    const latest = dates[dates.length - 1];
    return this.getDigest(latest);
  }

  async getDigest(date: string): Promise<WeeklyDigest | null> {
    const dir = digestDir(this.rootDir, date);
    return readJson<WeeklyDigest>(join(dir, "weekly.json"));
  }

  async getDigestEntries(digestId: string): Promise<DigestEntry[]> {
    // digestId is like "weekly_2026_03_23" — convert to date path
    const date = this.digestIdToDate(digestId);
    if (!date) return [];
    const dir = digestDir(this.rootDir, date);
    return (await readJson<DigestEntry[]>(join(dir, "entries.json"))) ?? [];
  }

  async getTopicPack(topicKey: string): Promise<TopicPack | null> {
    const dir = topicDir(this.rootDir, topicKey);
    return readJson<TopicPack>(join(dir, "latest.json"));
  }

  async getTopicHistory(topicKey: string): Promise<TopicPack[]> {
    const dir = topicDir(this.rootDir, topicKey);
    const history = await readJson<TopicPack[]>(join(dir, "history.json"));
    if (!history) return [];
    // Sort by date embedded in ID (topic_<key>_YYYY_MM_DD)
    return history.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getSourceBundle(ref: string): Promise<SourceBundle | null> {
    // ref can be a direct file path or a topic_key/date slug
    // Try as absolute path first
    const direct = await readJson<SourceBundle>(ref);
    if (direct) return direct;

    // Try interpreting as "topicKey/YYYY_MM_DD"
    const parts = ref.split("/");
    if (parts.length === 2) {
      const dir = topicSourcesDir(this.rootDir, parts[0]);
      return readJson<SourceBundle>(join(dir, `${parts[1]}.json`));
    }
    return null;
  }

  async getNormalizedItems(date: string): Promise<NormalizedItem[]> {
    const dir = normalizedDir(this.rootDir, date);
    return (
      (await readJson<NormalizedItem[]>(join(dir, "items.json"))) ?? []
    );
  }

  async getRunManifest(runId: string): Promise<RunManifest | null> {
    const dir = runsDir(this.rootDir);
    return readJson<RunManifest>(join(dir, `${runId}.json`));
  }

  async listDigests(): Promise<Array<{ date: string; id: string }>> {
    const dates = await this.scanDigestDates();
    dates.sort();
    return dates.map((date) => ({
      date,
      id: `weekly_${date.replace(/-/g, "_")}`,
    }));
  }

  async listRuns(): Promise<Array<{ id: string; date: string; status: string }>> {
    const dir = runsDir(this.rootDir);
    if (!(await dirExists(dir))) return [];

    const files = await readdir(dir);
    const results: Array<{ id: string; date: string; status: string }> = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const manifest = await readJson<RunManifest>(join(dir, file));
      if (manifest) {
        results.push({
          id: manifest.id,
          date: manifest.started_at.slice(0, 10),
          status: manifest.status,
        });
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── Private helpers ───────────────────────────────────────────────

  /**
   * Scans the digests directory tree (YYYY/MM/DD) and returns all dates found.
   */
  private async scanDigestDates(): Promise<string[]> {
    const base = join(this.rootDir, "digests");
    if (!(await dirExists(base))) return [];

    const dates: string[] = [];
    const years = await readdir(base);
    for (const y of years) {
      const yearDir = join(base, y);
      if (!(await dirExists(yearDir))) continue;
      const months = await readdir(yearDir);
      for (const m of months) {
        const monthDir = join(yearDir, m);
        if (!(await dirExists(monthDir))) continue;
        const days = await readdir(monthDir);
        for (const d of days) {
          const dayDir = join(monthDir, d);
          if (!(await dirExists(dayDir))) continue;
          dates.push(`${y}-${m}-${d}`);
        }
      }
    }
    return dates;
  }

  /**
   * Converts a digest ID like "weekly_2026_03_23" to "2026-03-23".
   */
  private digestIdToDate(digestId: string): string | null {
    const match = digestId.match(/^weekly_(\d{4})_(\d{2})_(\d{2})$/);
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
}
