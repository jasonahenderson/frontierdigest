import { join } from "node:path";

function dateParts(date: string): [string, string, string] {
  const [yyyy, mm, dd] = date.split("-");
  return [yyyy, mm, dd];
}

export function rawDir(rootDir: string, date: string): string {
  const [y, m, d] = dateParts(date);
  return join(rootDir, "data", "raw", y, m, d);
}

export function normalizedDir(rootDir: string, date: string): string {
  const [y, m, d] = dateParts(date);
  return join(rootDir, "data", "normalized", y, m, d);
}

export function digestDir(rootDir: string, date: string): string {
  const [y, m, d] = dateParts(date);
  return join(rootDir, "data", "digests", y, m, d);
}

export function topicDir(rootDir: string, topicKey: string): string {
  return join(rootDir, "data", "topics", topicKey);
}

export function topicSourcesDir(rootDir: string, topicKey: string): string {
  return join(rootDir, "data", "topics", topicKey, "sources");
}

export function runsDir(rootDir: string): string {
  return join(rootDir, "data", "runs");
}

export function logsDir(rootDir: string): string {
  return join(rootDir, "data", "logs");
}
