import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "digest", description: "Generate digests" },
  {
    weekly: () => import("./digest-weekly.js").then(m => m.default),
  },
);
