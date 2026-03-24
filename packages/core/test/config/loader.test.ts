import { describe, test, expect } from "bun:test";
import { join, resolve } from "node:path";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  loadProfile,
  loadSources,
  loadDomain,
  domainToProfileAndSources,
  validateConfig,
} from "../../src/config/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");
const PROFILE_PATH = join(FIXTURES_DIR, "profile.yaml");
const SOURCES_PATH = join(FIXTURES_DIR, "sources.yaml");
const DOMAINS_DIR = resolve(import.meta.dir, "..", "..", "..", "..", "configs", "domains");

describe("Config loader", () => {
  describe("loadProfile", () => {
    test("loads and parses the fixture profile.yaml", async () => {
      const profile = await loadProfile(PROFILE_PATH);
      expect(profile.profile).toBe("test-profile");
      expect(profile.window.weekly_lookback_days).toBe(7);
      expect(profile.interests.include).toContain("agents");
      expect(profile.interests.include).toContain("context engineering");
      expect(profile.interests.include).toContain("memory systems");
      expect(profile.interests.exclude).toContain("cryptocurrency");
      expect(profile.ranking.max_digest_items).toBe(3);
      expect(profile.ranking.relevance_weight).toBe(0.4);
      expect(profile.ranking.recency_weight).toBe(0.2);
      expect(profile.ranking.source_weight).toBe(0.2);
      expect(profile.ranking.reinforcement_weight).toBe(0.2);
      expect(profile.ranking.primary_source_bonus).toBe(0.2);
    });

    test("throws on non-existent file", async () => {
      await expect(loadProfile("/nonexistent/profile.yaml")).rejects.toThrow();
    });

    test("throws on invalid YAML content", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "fd-test-"));
      const badPath = join(tmpDir, "bad-profile.yaml");
      await writeFile(badPath, "profile: 123\nwindow: not_object\n", "utf-8");
      try {
        await expect(loadProfile(badPath)).rejects.toThrow();
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("loadSources", () => {
    test("loads and parses the fixture sources.yaml", async () => {
      const sources = await loadSources(SOURCES_PATH);
      expect(sources).toHaveLength(3);
      expect(sources[0].id).toBe("test-source-1");
      expect(sources[0].type).toBe("rss");
      expect(sources[0].name).toBe("Test Source One");
      expect(sources[0].weight).toBe(1.0);
      expect(sources[1].weight).toBe(0.8);
      expect(sources[2].weight).toBe(0.6);
      expect(sources[0].tags).toContain("agents");
    });

    test("throws on non-existent file", async () => {
      await expect(loadSources("/nonexistent/sources.yaml")).rejects.toThrow();
    });
  });

  describe("validateConfig", () => {
    test("validates valid fixture configs without errors", async () => {
      const result = await validateConfig(PROFILE_PATH, SOURCES_PATH);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("reports errors for non-existent profile path", async () => {
      const result = await validateConfig("/nonexistent/profile.yaml", SOURCES_PATH);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("reports errors for non-existent sources path", async () => {
      const result = await validateConfig(PROFILE_PATH, "/nonexistent/sources.yaml");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("warns when no interests are defined", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "fd-test-"));
      const profilePath = join(tmpDir, "profile.yaml");
      await writeFile(
        profilePath,
        [
          "profile: empty-interests",
          "window:",
          "  weekly_lookback_days: 7",
          "interests:",
          "  include: []",
          "  exclude: []",
          "ranking:",
          "  max_digest_items: 3",
          "  primary_source_bonus: 0.2",
          "  recency_weight: 0.2",
          "  relevance_weight: 0.4",
          "  source_weight: 0.2",
          "  reinforcement_weight: 0.2",
          "outputs:",
          "  root_dir: ./data",
          "  write_markdown: true",
          "  write_json: true",
          "slack:",
          "  enabled: false",
          "  channel: '#test'",
          "  post_threads: false",
        ].join("\n"),
        "utf-8",
      );
      try {
        const result = await validateConfig(profilePath, SOURCES_PATH);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.message.includes("No interests"))).toBe(true);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    test("warns when all ranking weights are zero", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "fd-test-"));
      const profilePath = join(tmpDir, "profile.yaml");
      await writeFile(
        profilePath,
        [
          "profile: zero-weights",
          "window:",
          "  weekly_lookback_days: 7",
          "interests:",
          "  include:",
          "    - agents",
          "  exclude: []",
          "ranking:",
          "  max_digest_items: 3",
          "  primary_source_bonus: 0.0",
          "  recency_weight: 0",
          "  relevance_weight: 0",
          "  source_weight: 0",
          "  reinforcement_weight: 0",
          "outputs:",
          "  root_dir: ./data",
          "  write_markdown: true",
          "  write_json: true",
          "slack:",
          "  enabled: false",
          "  channel: '#test'",
          "  post_threads: false",
        ].join("\n"),
        "utf-8",
      );
      try {
        const result = await validateConfig(profilePath, SOURCES_PATH);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.message.includes("All ranking weights are 0"))).toBe(
          true,
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("domain config with LLM", () => {
    test("loads domain with llm section", async () => {
      const domain = await loadDomain(join(DOMAINS_DIR, "ai-frontier.yaml"));
      expect(domain.domain.id).toBe("ai-frontier");
      expect(domain.domain.llm).toBeDefined();
      expect(domain.domain.llm?.provider).toBe("anthropic");
    });

    test("domainToProfileAndSources works without llm section", async () => {
      const domain = await loadDomain(join(DOMAINS_DIR, "ai-frontier.yaml"));
      const resolved = domainToProfileAndSources(domain);
      expect(resolved.profile).toBeDefined();
      expect(resolved.sources.length).toBeGreaterThan(0);
      expect(resolved.promptContext).toBeDefined();
    });

    test("loads domain with llm config from temp file", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "fd-test-"));
      const domainPath = join(tmpDir, "test-domain.yaml");
      await writeFile(
        domainPath,
        [
          "domain:",
          "  id: test-llm",
          '  name: "Test LLM Domain"',
          "  prompt_context:",
          '    persona: "Test persona"',
          '    focus: "Test focus"',
          "  profile:",
          "    window:",
          "      weekly_lookback_days: 7",
          "    interests:",
          "      include:",
          "        - testing",
          "      exclude: []",
          "    ranking:",
          "      max_digest_items: 3",
          "  sources:",
          "    - id: test-src",
          "      type: rss",
          '      name: "Test Source"',
          "      url: https://example.com/feed.xml",
          "      weight: 1.0",
          "      tags: [test]",
          "  llm:",
          "    provider: openai",
          "    model: gpt-4o-mini",
          "    temperature: 0.5",
          "  slack:",
          "    enabled: false",
          "    channel: '#test'",
          "    post_threads: false",
        ].join("\n"),
        "utf-8",
      );
      try {
        const domain = await loadDomain(domainPath);
        expect(domain.domain.llm).toBeDefined();
        expect(domain.domain.llm?.provider).toBe("openai");
        expect(domain.domain.llm?.model).toBe("gpt-4o-mini");
        expect(domain.domain.llm?.temperature).toBe(0.5);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    test("domain with llm defaults provider to anthropic", async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), "fd-test-"));
      const domainPath = join(tmpDir, "test-domain.yaml");
      await writeFile(
        domainPath,
        [
          "domain:",
          "  id: test-llm-default",
          '  name: "Test LLM Default"',
          "  prompt_context:",
          '    persona: "Test persona"',
          '    focus: "Test focus"',
          "  profile:",
          "    window:",
          "      weekly_lookback_days: 7",
          "    interests:",
          "      include:",
          "        - testing",
          "      exclude: []",
          "    ranking:",
          "      max_digest_items: 3",
          "  sources:",
          "    - id: test-src",
          "      type: rss",
          '      name: "Test Source"',
          "      url: https://example.com/feed.xml",
          "      weight: 1.0",
          "      tags: [test]",
          "  llm: {}",
          "  slack:",
          "    enabled: false",
          "    channel: '#test'",
          "    post_threads: false",
        ].join("\n"),
        "utf-8",
      );
      try {
        const domain = await loadDomain(domainPath);
        expect(domain.domain.llm).toBeDefined();
        expect(domain.domain.llm?.provider).toBe("anthropic");
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    test("domain without llm section still works with loadProfile", async () => {
      const profile = await loadProfile(PROFILE_PATH);
      expect(profile).toBeDefined();
      expect(profile.profile).toBe("test-profile");
    });
  });
});
