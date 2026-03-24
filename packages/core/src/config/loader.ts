import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import {
  ProfileConfigSchema,
  type ProfileConfig,
  SourcesConfigSchema,
  type SourcesConfig,
  type SourceConfig,
  DomainConfigSchema,
  type DomainConfig,
  type PromptContext,
} from "../types/index.js";

export async function loadProfile(path: string): Promise<ProfileConfig> {
  const raw = await readFile(path, "utf-8");
  const parsed = parseYaml(raw);
  return ProfileConfigSchema.parse(parsed);
}

export async function loadSources(path: string): Promise<SourceConfig[]> {
  const raw = await readFile(path, "utf-8");
  const parsed = parseYaml(raw);
  const config: SourcesConfig = SourcesConfigSchema.parse(parsed);
  return config.sources;
}

export async function loadDomain(path: string): Promise<DomainConfig> {
  const raw = await readFile(path, "utf-8");
  const parsed = parseYaml(raw);
  return DomainConfigSchema.parse(parsed);
}

export function domainToProfileAndSources(domain: DomainConfig): {
  profile: ProfileConfig;
  sources: SourceConfig[];
  promptContext: PromptContext;
} {
  const d = domain.domain;
  return {
    profile: {
      profile: d.id,
      window: d.profile.window,
      interests: d.profile.interests,
      ranking: d.profile.ranking,
      outputs: {
        ...d.profile.outputs,
        // Namespace the root_dir by domain ID
        root_dir: `${d.profile.outputs.root_dir}/${d.id}`,
      },
      slack: d.slack,
    },
    sources: d.sources,
    promptContext: d.prompt_context,
  };
}
