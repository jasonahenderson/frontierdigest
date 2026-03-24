import { defineCommand } from "citty";
import consola from "consola";
import { writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { stringify as yamlStringify } from "yaml";

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

    // Step 3: Generate config via LLM
    consola.start("Generating domain configuration...");

    try {
      const { generateDomainConfig } = await import("@frontier-digest/core");
      const result = await generateDomainConfig({
        topicDescription: topic,
        slackEnabled: !!wantSlack,
        slackChannel: slackChannel,
      });

      const config = result.domainConfig;

      // Step 4: Show summary
      consola.log("");
      consola.info(`Domain: ${config.domain.name}`);
      consola.info(`ID: ${config.domain.id}`);
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

      const yamlContent = yamlStringify(config, { lineWidth: 120 });
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
      if (
        error instanceof Error &&
        error.message.includes("ANTHROPIC_API_KEY")
      ) {
        consola.error(
          "ANTHROPIC_API_KEY environment variable is required for the init wizard.",
        );
        consola.info(
          "Set it with: export ANTHROPIC_API_KEY=your-key-here",
        );
        consola.info(
          "Or use a template: frontier-digest init --template ai-frontier",
        );
      } else {
        consola.error("Failed to generate config:", error);
      }
      process.exitCode = 1;
    }
  },
});
