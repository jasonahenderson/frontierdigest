import { App } from "@slack/bolt";
import type { Store } from "@frontier-digest/core";
import type { SlackConfig } from "@frontier-digest/core";
import { registerInteractions } from "./interactions.js";

/**
 * Create a Bolt app wired up with all interaction handlers.
 * The caller is responsible for starting the app with `await app.start()`.
 */
export function createInteractionServer(
  store: Store,
  config: SlackConfig,
): App {
  const useSocketMode = Boolean(config.app_token);

  const app = new App({
    token: config.bot_token,
    signingSecret: config.signing_secret,
    ...(useSocketMode
      ? { socketMode: true, appToken: config.app_token }
      : {}),
  });

  registerInteractions(app, store);

  return app;
}
