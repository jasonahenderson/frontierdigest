import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { WeeklyDigest, DigestEntry } from "@frontier-digest/core";
import { postWeeklyDigest } from "../../src/post.js";

const CORE_FIXTURES_DIR = join(import.meta.dir, "..", "..", "..", "core", "test", "fixtures");

async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(CORE_FIXTURES_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

// Gate behind FD_TEST_SLACK env var
const SKIP = !process.env.FD_TEST_SLACK;

describe.skipIf(SKIP)("Slack E2E (real Slack API)", () => {
  test("posts weekly digest to Slack test channel", async () => {
    const botToken = process.env.FD_SLACK_BOT_TOKEN;
    const channel = process.env.FD_SLACK_TEST_CHANNEL;

    if (!botToken || !channel) {
      throw new Error(
        "FD_SLACK_BOT_TOKEN and FD_SLACK_TEST_CHANNEL must be set for Slack E2E tests",
      );
    }

    const digest = await loadFixture<WeeklyDigest>("weekly-digest.json");
    const entries = await loadFixture<DigestEntry[]>("digest-entries.json");

    const result = await postWeeklyDigest(digest, entries, {
      enabled: true,
      bot_token: botToken,
      channel,
      post_threads: false,
    });

    expect(result.ok).toBe(true);
    expect(result.channel).toBeTypeOf("string");
    expect(result.ts).toBeTypeOf("string");
  }, { timeout: 30_000 });
});
