import { describe, test, expect } from "bun:test";
import { join } from "node:path";

const CLI_PATH = join(import.meta.dir, "../../src/index.ts");
const PROJECT_ROOT = join(import.meta.dir, "../../../..");
const VALID_DOMAIN = join(PROJECT_ROOT, "configs/domains/ai-frontier.yaml");
const FIXTURES_DIR = join(PROJECT_ROOT, "packages/core/test/fixtures");

async function runCli(
  args: string[],
  timeout = 15_000,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  // Bun test runner's inherited env breaks subprocess output capture.
  // Explicitly construct a clean env to work around this.
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    NO_COLOR: "1",
  };

  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const dir = await mkdtemp(join(tmpDir, "fd-cli-test-"));
  const outFile = join(dir, "stdout.txt");
  const errFile = join(dir, "stderr.txt");

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
  await rm(dir, { recursive: true, force: true });

  return { exitCode, stdout, stderr };
}

describe("CLI smoke tests", () => {
  test("--help prints usage", async () => {
    const { exitCode, stdout } = await runCli(["--help"]);

    expect(exitCode).toBe(0);
    expect(stdout.toLowerCase()).toMatch(/frontier.digest|usage/);
  });

  test("validate --domain with valid config exits 0", async () => {
    const { exitCode, stdout, stderr } = await runCli([
      "validate",
      "--domain",
      VALID_DOMAIN,
    ]);

    // Should succeed or at least not crash
    const output = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(output.toLowerCase()).toMatch(/valid|ok|success/);
  });

  test("validate --profile and --sources with fixtures exits 0", async () => {
    const profilePath = join(FIXTURES_DIR, "profile.yaml");
    const sourcesPath = join(FIXTURES_DIR, "sources.yaml");

    const { exitCode, stdout, stderr } = await runCli([
      "validate",
      "--profile",
      profilePath,
      "--sources",
      sourcesPath,
    ]);

    const output = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(output.toLowerCase()).toMatch(/valid|ok|success/);
  });

  test("run --help shows subcommand help", async () => {
    const { exitCode, stdout, stderr } = await runCli(["run", "--help"]);
    const output = stdout + stderr;

    // Should show help, not error
    expect(exitCode).toBe(0);
    expect(output.toLowerCase()).toMatch(/weekly|run|usage|help/);
  });

  test("unknown command exits with non-zero or shows help", async () => {
    const { exitCode, stdout, stderr } = await runCli(["nonexistent-cmd"]);
    const output = stdout + stderr;

    // Should either exit non-zero or print an error/help message
    const hasError =
      exitCode !== 0 ||
      output.toLowerCase().includes("unknown") ||
      output.toLowerCase().includes("error") ||
      output.toLowerCase().includes("help");
    expect(hasError).toBe(true);
  });

  test("validate with missing file exits non-zero or reports error", async () => {
    const { exitCode, stdout, stderr } = await runCli([
      "validate",
      "--domain",
      "/tmp/nonexistent-file.yaml",
    ]);
    const output = stdout + stderr;

    const hasError =
      exitCode !== 0 ||
      output.toLowerCase().includes("error") ||
      output.toLowerCase().includes("not found") ||
      output.toLowerCase().includes("no such file");
    expect(hasError).toBe(true);
  });
});
