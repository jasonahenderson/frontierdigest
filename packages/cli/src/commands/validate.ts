import { defineCommand } from "citty";
import consola from "consola";

export default defineCommand({
  meta: {
    name: "validate",
    description: "Validate configuration files",
  },
  args: {
    domain: {
      type: "string",
      description: "Path to domain config (alternative to --profile + --sources)",
    },
    profile: {
      type: "string",
      description: "Path to profile config",
      default: "configs/profile.sample.yaml",
    },
    sources: {
      type: "string",
      description: "Path to sources config",
      default: "configs/sources.sample.yaml",
    },
  },
  async run({ args }) {
    const { validateConfigPath } = await import("@frontier-digest/core");

    // Validate paths before use
    if (args.domain) {
      args.domain = validateConfigPath(args.domain);
    } else {
      args.profile = validateConfigPath(args.profile);
      args.sources = validateConfigPath(args.sources);
    }

    if (args.domain) {
      const { validateDomainConfig } = await import("@frontier-digest/core");

      consola.info(`Validating domain config: ${args.domain}`);
      const result = await validateDomainConfig(args.domain);

      if (result.valid) {
        consola.success("Domain configuration is valid");
      } else {
        consola.error("Domain configuration has errors:");
        for (const err of result.errors) {
          consola.error(`  ${err.file}: ${err.path} — ${err.message}`);
        }
      }

      for (const warn of result.warnings) {
        consola.warn(`  ${warn.file}: ${warn.message}`);
      }
    } else {
      const { validateConfig } = await import("@frontier-digest/core");

      const result = await validateConfig(args.profile, args.sources);

      if (result.valid) {
        consola.success("Configuration is valid");
      } else {
        consola.error("Configuration has errors:");
        for (const err of result.errors) {
          consola.error(`  ${err.file}: ${err.path} — ${err.message}`);
        }
      }

      for (const warn of result.warnings) {
        consola.warn(`  ${warn.file}: ${warn.message}`);
      }
    }
  },
});
