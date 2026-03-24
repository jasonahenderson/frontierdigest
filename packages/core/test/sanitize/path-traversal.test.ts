import { describe, test, expect } from "bun:test";
import { validateConfigPath, validateOutputPath } from "../../src/sanitize/paths.js";

describe("validateConfigPath", () => {
  test("accepts relative path within project", () => {
    const result = validateConfigPath("configs/domains/ai-frontier.yaml");
    expect(result).toContain("configs/domains/ai-frontier.yaml");
  });

  test("rejects path traversal with ../", () => {
    expect(() => validateConfigPath("../../etc/passwd")).toThrow();
  });

  test("rejects absolute path outside project", () => {
    expect(() => validateConfigPath("/etc/passwd")).toThrow();
  });

  test("accepts absolute path within project", () => {
    const cwd = process.cwd();
    const result = validateConfigPath(`${cwd}/configs/domains/ai-frontier.yaml`);
    expect(result).toContain("configs/domains/ai-frontier.yaml");
  });
});

describe("validateOutputPath", () => {
  test("accepts path within allowed directory", () => {
    const result = validateOutputPath("my-domain.yaml", "configs/domains");
    expect(result).toContain("my-domain.yaml");
  });

  test("rejects path escaping allowed directory", () => {
    expect(() => validateOutputPath("../../evil.yaml", "configs/domains")).toThrow();
  });

  test("rejects absolute path outside allowed directory", () => {
    expect(() => validateOutputPath("/tmp/evil.yaml", "configs/domains")).toThrow();
  });
});
