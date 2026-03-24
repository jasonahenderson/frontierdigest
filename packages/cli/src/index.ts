#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "frontier-digest",
    version: "0.1.0",
    description: "Domain-configurable weekly research digest system",
  },
  subCommands: {
    init: () => import("./commands/init.js").then(m => m.default),
    ingest: () => import("./commands/ingest.js").then(m => m.default),
    digest: () => import("./commands/digest.js").then(m => m.default),
    slack: () => import("./commands/slack.js").then(m => m.default),
    topic: () => import("./commands/topic.js").then(m => m.default),
    diff: () => import("./commands/diff.js").then(m => m.default),
    validate: () => import("./commands/validate.js").then(m => m.default),
    run: () => import("./commands/run.js").then(m => m.default),
    list: () => import("./commands/list.js").then(m => m.default),
    inspect: () => import("./commands/inspect.js").then(m => m.default),
  },
});

runMain(main);
