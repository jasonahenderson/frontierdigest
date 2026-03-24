import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "topic",
    description: "Topic inspection commands",
  },
  subCommands: {
    show: () => import("./topic-show.js").then(m => m.default),
    sources: () => import("./topic-sources.js").then(m => m.default),
  },
});
