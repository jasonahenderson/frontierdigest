import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PromptContext } from "../types/index.js";

/** Default context preserving original AI-frontier behaviour. */
const DEFAULT_CONTEXT: PromptContext = {
  persona: "You are an expert AI research analyst.",
  focus: "frontier AI research and development",
};

export async function loadPrompt(
  templateName: string,
  variables: Record<string, string>,
  promptsDir?: string,
  context?: PromptContext,
): Promise<{ system: string; user: string }> {
  const dir = promptsDir ?? resolve(import.meta.dirname, "../../../../prompts");
  const filePath = resolve(dir, `${templateName}.md`);
  const raw = await readFile(filePath, "utf-8");

  // Split at ## System and ## User headers
  const systemMatch = raw.match(/## System\s*\n([\s\S]*?)(?=\n## User)/);
  const userMatch = raw.match(/## User\s*\n([\s\S]*)$/);

  if (!systemMatch || !userMatch) {
    throw new Error(
      `Prompt template "${templateName}" must contain ## System and ## User sections`,
    );
  }

  let system = systemMatch[1].trim();
  let user = userMatch[1].trim();

  // Merge persona/focus context with caller-supplied variables.
  // Caller variables take precedence if they also specify persona/focus.
  const ctx = context ?? DEFAULT_CONTEXT;
  const merged: Record<string, string> = {
    persona: ctx.persona,
    focus: ctx.focus,
    ...variables,
  };

  // Replace all {{variable}} placeholders
  for (const [key, value] of Object.entries(merged)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    system = system.replace(pattern, value);
    user = user.replace(pattern, value);
  }

  return { system, user };
}
