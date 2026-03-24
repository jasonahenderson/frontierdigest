import Anthropic from "@anthropic-ai/sdk";
import { consola } from "consola";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }
  return client;
}

export async function llmGenerate(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 4096;
  const temperature = options?.temperature ?? 0.3;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const firstBlock = response.content[0];
    if (firstBlock.type !== "text") {
      throw new Error(`Unexpected content block type: ${firstBlock.type}`);
    }
    return firstBlock.text;
  } catch (error) {
    consola.error("LLM generation failed:", error);
    throw error;
  }
}
