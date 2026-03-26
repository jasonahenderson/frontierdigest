import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { loadDomain, domainToProfileAndSources } from "../../src/config/loader.js";
import { validateDomainConfig } from "../../src/config/validate.js";
import { FIXTURES_DIR } from "../helpers/fixtures.js";

const DOMAIN_CONFIG_PATH = join(FIXTURES_DIR, "domain-config-test.yaml");

describe("Config to pipeline integration", () => {
  test("loads domain config and extracts profile", async () => {
    const domain = await loadDomain(DOMAIN_CONFIG_PATH);
    const { profile, sources, promptContext } = domainToProfileAndSources(domain);

    expect(profile.profile).toBe("test-domain");
    expect(profile.window.weekly_lookback_days).toBe(30);
    expect(profile.interests.include).toContain("agents");
    expect(profile.interests.include).toContain("memory-systems");
    expect(profile.interests.exclude).toContain("cryptocurrency");
    expect(profile.ranking.max_digest_items).toBe(3);
  });

  test("extracts sources from domain config", async () => {
    const domain = await loadDomain(DOMAIN_CONFIG_PATH);
    const { sources } = domainToProfileAndSources(domain);

    expect(sources.length).toBe(2);
    expect(sources[0].id).toBe("test-feed-1");
    expect(sources[0].type).toBe("rss");
    expect(sources[0].weight).toBe(1.0);
    expect(sources[1].id).toBe("test-feed-2");
    expect(sources[1].weight).toBe(0.8);
  });

  test("extracts prompt context from domain config", async () => {
    const domain = await loadDomain(DOMAIN_CONFIG_PATH);
    const { promptContext } = domainToProfileAndSources(domain);

    expect(promptContext.persona).toBe("You are a test analyst.");
    expect(promptContext.focus).toBe("test topics for integration testing");
  });

  test("extracts LLM config from domain config", async () => {
    const domain = await loadDomain(DOMAIN_CONFIG_PATH);
    const { llmConfig } = domainToProfileAndSources(domain);

    expect(llmConfig).toBeDefined();
    expect(llmConfig!.provider).toBe("anthropic");
    expect(llmConfig!.model).toBe("claude-sonnet-4-20250514");
  });

  test("domain config validation succeeds for valid config", async () => {
    const result = await validateDomainConfig(DOMAIN_CONFIG_PATH);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("namespaces root_dir by domain ID", async () => {
    const domain = await loadDomain(DOMAIN_CONFIG_PATH);
    const { profile } = domainToProfileAndSources(domain);

    expect(profile.outputs.root_dir).toContain("test-domain");
  });

  test("real domain config (ai-frontier) loads and validates", async () => {
    const configPath = join(
      import.meta.dir,
      "../../../../configs/domains/ai-frontier.yaml",
    );

    const domain = await loadDomain(configPath);
    const { profile, sources, promptContext } = domainToProfileAndSources(domain);

    expect(profile.profile).toBeTypeOf("string");
    expect(sources.length).toBeGreaterThan(0);
    expect(promptContext.persona).toBeTypeOf("string");
    expect(promptContext.focus).toBeTypeOf("string");

    // All sources should have required fields
    for (const source of sources) {
      expect(source.id).toBeTypeOf("string");
      expect(source.type).toBe("rss");
      expect(source.url).toMatch(/^https?:\/\//);
    }
  });
});
