import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "post", description: "Post digests to Slack" },
  {
    weekly: () => import("./slack-post-weekly.js").then(m => m.default),
  },
);
