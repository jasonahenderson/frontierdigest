import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "post",
    description: "Post digests to Slack",
  },
  subCommands: {
    weekly: () => import("./slack-post-weekly.js").then(m => m.default),
  },
});
