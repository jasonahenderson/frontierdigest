import { defineCommand } from "citty";
import consola from "consola";
import { writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { LLMConfig } from "@frontier-digest/core";

export default defineCommand({
  meta: {
    name: "init",
    description: "Interactive setup wizard for creating a new domain config",
  },
  args: {
    template: {
      type: "string",
      description:
        "Use a pre-built template (ai-frontier, quantum-computing, brain-science)",
    },
    output: {
      type: "string",
      description: "Output path for the domain config",
    },
  },
  async run({ args }) {
    if (args.output) {
      const { validateOutputPath } = await import("@frontier-digest/core");
      args.output = validateOutputPath(args.output, "configs");
    }

    if (args.template) {
      const { getTemplatePath, listTemplates } = await import(
        "@frontier-digest/core"
      );
      const templatePath = getTemplatePath(args.template);
      if (!templatePath) {
        consola.error(`Unknown template: ${args.template}`);
        consola.info("Available templates:");
        for (const t of listTemplates()) {
          consola.info(`  ${t.id} — ${t.description}`);
        }
        process.exitCode = 1;
        return;
      }
      const outputPath =
        args.output ?? `configs/domains/${args.template}.yaml`;
      try {
        await access(outputPath);
        consola.warn(`File already exists: ${outputPath}`);
      } catch {
        // doesn't exist, good
      }
      await mkdir(dirname(outputPath), { recursive: true });
      await copyFile(templatePath, outputPath);
      consola.success(`Domain config created: ${outputPath}`);
      consola.info(
        `Run: frontier-digest run weekly --domain ${outputPath}`,
      );
      return;
    }

    // Interactive wizard
    consola.box("Frontier Digest Setup Wizard");

    // Step 1: Get topic description
    const topic = await consola.prompt("What topic do you want to track?", {
      type: "text",
      placeholder:
        "e.g., quantum computing breakthroughs, travel in Southeast Asia, neuroscience advances",
    });

    if (!topic || typeof topic !== "string") {
      consola.error("No topic provided.");
      return;
    }

    // Step 2: Ask about Slack
    const wantSlack = await consola.prompt("Post digests to Slack?", {
      type: "confirm",
      initial: false,
    });

    let slackChannel = "#digest";
    if (wantSlack) {
      const channel = await consola.prompt("Slack channel name:", {
        type: "text",
        placeholder: "#my-digest",
        initial: "#digest",
      });
      if (channel && typeof channel === "string") {
        slackChannel = channel.startsWith("#") ? channel : `#${channel}`;
      }
    }

    // Step 2.5: LLM provider selection
    const availableProviders: Array<{ value: string; label: string; hint?: string }> = [];

    // Check for Ollama (local, free)
    let ollamaAvailable = false;
    try {
      const resp = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        ollamaAvailable = true;
        const data = await resp.json() as { models?: Array<{ name: string }> };
        const modelCount = data.models?.length ?? 0;
        availableProviders.push({
          value: "ollama",
          label: `Ollama (local, free) — ${modelCount} model${modelCount !== 1 ? "s" : ""} installed`,
          hint: "No API key needed",
        });
      }
    } catch {
      // Ollama not running
    }

    // Check for API keys in env
    if (process.env.ANTHROPIC_API_KEY) {
      availableProviders.push({
        value: "anthropic",
        label: "Anthropic (Claude) — API key detected",
      });
    } else {
      availableProviders.push({
        value: "anthropic",
        label: "Anthropic (Claude) — requires API key",
        hint: "https://console.anthropic.com/",
      });
    }

    if (process.env.OPENAI_API_KEY) {
      availableProviders.push({
        value: "openai",
        label: "OpenAI (GPT-4o) — API key detected",
      });
    } else {
      availableProviders.push({
        value: "openai",
        label: "OpenAI (GPT-4) — requires API key",
        hint: "https://platform.openai.com/api-keys",
      });
    }

    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      availableProviders.push({
        value: "google",
        label: "Google (Gemini) — API key detected",
      });
    }

    // Ask user to pick provider
    const providerChoice = await consola.prompt("Which AI provider do you want to use?", {
      type: "select",
      options: availableProviders.map(p => p.label),
    });

    // Map back to provider value
    const selectedProvider = availableProviders.find(p => p.label === providerChoice);
    const providerValue = selectedProvider?.value ?? "anthropic";

    // Build LLM config for the selected provider
    const llmConfig: LLMConfig = { provider: providerValue as LLMConfig["provider"] };

    // For Ollama, ask which model to use
    if (providerValue === "ollama" && ollamaAvailable) {
      try {
        const resp = await fetch("http://localhost:11434/api/tags");
        const data = await resp.json() as { models?: Array<{ name: string }> };
        const models = data.models?.map(m => m.name) ?? [];
        if (models.length > 0) {
          const modelChoice = await consola.prompt("Which Ollama model?", {
            type: "select",
            options: models,
          });
          if (modelChoice && typeof modelChoice === "string") {
            llmConfig.model = modelChoice;
          }
        } else {
          consola.warn("No models installed. Run: ollama pull llama3.1");
          llmConfig.model = "llama3.1";
        }
      } catch {
        llmConfig.model = "llama3.1";
      }
    }

    // For providers requiring API keys, check they're set
    if (providerValue === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
      consola.warn("ANTHROPIC_API_KEY not set. You'll need it to run the digest.");
      consola.info("Get one at: https://console.anthropic.com/");
      consola.info("Then: export ANTHROPIC_API_KEY=sk-ant-...");
    } else if (providerValue === "openai" && !process.env.OPENAI_API_KEY) {
      consola.warn("OPENAI_API_KEY not set. You'll need it to run the digest.");
      consola.info("Get one at: https://platform.openai.com/api-keys");
    } else if (providerValue === "google" && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      consola.warn("GOOGLE_GENERATIVE_AI_API_KEY not set.");
      consola.info("Get one at: https://aistudio.google.com/apikey");
    }

    // Step 3: Generate config via LLM
    consola.start("Generating domain configuration...");

    try {
      const { generateDomainConfig } = await import("@frontier-digest/core");
      const result = await generateDomainConfig(
        {
          topicDescription: topic,
          slackEnabled: !!wantSlack,
          slackChannel: slackChannel,
        },
        llmConfig,
      );

      const config = result.domainConfig;

      // Inject the selected LLM provider into the config
      const configWithLLM = {
        ...config,
        domain: {
          ...config.domain,
          llm: {
            provider: llmConfig.provider,
            ...(llmConfig.model ? { model: llmConfig.model } : {}),
            ...(llmConfig.base_url ? { base_url: llmConfig.base_url } : {}),
          },
        },
      };

      // Step 4: Show summary
      consola.log("");
      consola.info(`Domain: ${config.domain.name}`);
      consola.info(`ID: ${config.domain.id}`);
      consola.info(`LLM: ${llmConfig.provider}${llmConfig.model ? ` (${llmConfig.model})` : ""}`);
      consola.log("");
      consola.info("Interests (include):");
      for (const interest of config.domain.profile.interests.include) {
        consola.log(`  + ${interest}`);
      }
      consola.info("Interests (exclude):");
      for (const ex of config.domain.profile.interests.exclude) {
        consola.log(`  - ${ex}`);
      }
      consola.log("");
      consola.info("Sources:");
      for (const source of config.domain.sources) {
        consola.log(`  * ${source.name} (${source.url})`);
      }

      // Step 5: Confirm
      const accept = await consola.prompt("Accept this configuration?", {
        type: "confirm",
        initial: true,
      });

      if (!accept) {
        consola.info("Cancelled. You can re-run with different input.");
        return;
      }

      // Step 6: Write config
      const outputPath =
        args.output ?? `configs/domains/${result.suggestedFilename}`;
      await mkdir(dirname(resolve(outputPath)), { recursive: true });

      const yamlContent = yamlStringify(configWithLLM, { lineWidth: 120 });
      await writeFile(resolve(outputPath), yamlContent, "utf-8");

      consola.success(`Config written to ${outputPath}`);

      // Step 7: Slack token guidance if needed
      if (wantSlack) {
        consola.log("");
        consola.info("To complete Slack setup:");
        consola.log("  1. Go to https://api.slack.com/apps");
        consola.log("  2. Create New App -> From Scratch");
        consola.log(
          "  3. Add Bot Token Scopes: chat:write, channels:read",
        );
        consola.log("  4. Install to workspace");
        consola.log("  5. Set environment variables:");
        consola.log("     SLACK_BOT_TOKEN=xoxb-...");
        consola.log("     SLACK_SIGNING_SECRET=...");
      }

      consola.log("");
      consola.success("Ready! Run your first digest:");
      consola.log(
        `  frontier-digest run weekly --domain ${outputPath}`,
      );
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes("API_KEY") ||
        error.message.includes("api key") ||
        error.message.includes("401") ||
        error.message.includes("403")
      )) {
        consola.error("API key issue — check that your provider's API key is set correctly.");
        consola.info("Or use a template (no API key needed): frontier-digest init --template ai-frontier");
      } else if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
        consola.error("Could not connect to the LLM provider.");
        if (providerValue === "ollama") {
          consola.info("Make sure Ollama is running: ollama serve");
        }
        consola.info("Or use a template: frontier-digest init --template ai-frontier");
      } else {
        consola.error("Failed to generate config:", error);
      }
      process.exitCode = 1;
    }
  },
});
