import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "topic", description: "Topic inspection commands" },
  {
    show: () => import("./topic-show.js").then(m => m.default),
    sources: () => import("./topic-sources.js").then(m => m.default),
  },
);
