import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "diff", description: "Compare digests" },
  {
    weekly: () => import("./diff-weekly.js").then(m => m.default),
  },
);
