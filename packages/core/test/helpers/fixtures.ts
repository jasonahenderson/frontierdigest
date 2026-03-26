import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

export async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}
