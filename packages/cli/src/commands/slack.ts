import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "slack", description: "Slack integration commands" },
  {
    post: () => import("./slack-post.js").then(m => m.default),
  },
);
