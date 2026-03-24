import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "slack",
    description: "Slack integration commands",
  },
  subCommands: {
    post: () => import("./slack-post.js").then(m => m.default),
  },
});
