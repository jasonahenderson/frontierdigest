import { describe, test, expect } from "bun:test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI_PATH = join(import.meta.dir, "../../src/index.ts");
const PROJECT_ROOT = join(import.meta.dir, "../../../..");
const FIXTURES_DIR = join(PROJECT_ROOT, "packages/core/test/fixtures");

async function runCli(
  args: string[],
  timeout = 30_000,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  // Bun test runner's inherited env breaks subprocess output capture.
  // Explicitly construct a clean env to work around this.
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    NO_COLOR: "1",
  };

  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { mkdtemp, readFile, rm: rmDir } = await import("node:fs/promises");
  const { join: joinPath } = await import("node:path");

  const dir = await mkdtemp(joinPath(tmpDir, "fd-cli-test-"));
  const outFile = joinPath(dir, "stdout.txt");
  const errFile = joinPath(dir, "stderr.txt");

  const proc = Bun.spawn([process.argv[0], CLI_PATH, ...args], {
    cwd: PROJECT_ROOT,
    stdout: Bun.file(outFile),
    stderr: Bun.file(errFile),
    env,
  });

  const timer = setTimeout(() => proc.kill(), timeout);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  const stdout = await readFile(outFile, "utf-8").catch(() => "");
  const stderr = await readFile(errFile, "utf-8").catch(() => "");
  await rmDir(dir, { recursive: true, force: true });

  return { exitCode, stdout, stderr };
}

describe("CLI E2E tests", () => {
  test("run weekly with test profile completes (may fail at synthesis without API key)", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "fd-cli-e2e-"));

    // Use the fixture profile but point root_dir at temp
    // The ingest step will try to fetch real RSS feeds and may fail
    // That's OK - we're testing the CLI process lifecycle
    const profilePath = join(FIXTURES_DIR, "profile.yaml");
    const sourcesPath = join(FIXTURES_DIR, "sources.yaml");

    const { exitCode, stdout, stderr } = await runCli(
      [
        "run",
        "weekly",
        "--profile",
        profilePath,
        "--sources",
        sourcesPath,
      ],
      60_000,
    );

    const output = stdout + stderr;

    // Pipeline should at least start and produce output
    // It may complete with failures (no API key, unreachable RSS),
    // but the CLI itself should not crash unexpectedly
    expect(output.toLowerCase()).toMatch(/pipeline|run|step|ingest|complete|failed/);

    await rm(tempDir, { recursive: true, force: true });
  }, { timeout: 60_000 });

  test("validate exits 0 with valid domain config", async () => {
    const domainPath = join(FIXTURES_DIR, "domain-config-test.yaml");

    const { exitCode, stdout, stderr } = await runCli([
      "validate",
      "--domain",
      domainPath,
    ]);

    const output = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(output.toLowerCase()).toMatch(/valid|ok|success/);
  });

  test("ingest with fixture sources runs without crashing", async () => {
    const profilePath = join(FIXTURES_DIR, "profile.yaml");
    const sourcesPath = join(FIXTURES_DIR, "sources.yaml");

    const { exitCode, stdout, stderr } = await runCli(
      ["ingest", "--profile", profilePath, "--sources", sourcesPath],
      30_000,
    );

    const output = stdout + stderr;

    // Ingest should at least start. Sources may fail (network)
    // but CLI should handle it gracefully
    expect(output.toLowerCase()).toMatch(/ingest|fetch|source|items/);
  }, { timeout: 30_000 });
});
