import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PromptContext } from "../types/index.js";
import { wrapUntrustedContent } from "../sanitize/index.js";

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

  const TRUSTED_VARS = new Set(["persona", "focus"]);

  const ctx = context ?? DEFAULT_CONTEXT;
  const trustedVars: Record<string, string> = {
    persona: ctx.persona,
    focus: ctx.focus,
  };

  // System section: ONLY substitute trusted vars (persona, focus)
  for (const [key, value] of Object.entries(trustedVars)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    system = system.replace(pattern, value);
  }

  // User section: substitute trusted vars normally, untrusted vars with boundary wrapping
  const allVars = { ...trustedVars, ...variables };
  for (const [key, value] of Object.entries(allVars)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    if (TRUSTED_VARS.has(key)) {
      user = user.replace(pattern, value);
    } else {
      user = user.replace(pattern, wrapUntrustedContent(key, value));
    }
  }

  return { system, user };
}
