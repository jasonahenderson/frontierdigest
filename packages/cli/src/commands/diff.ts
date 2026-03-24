import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "diff",
    description: "Compare digests",
  },
  subCommands: {
    weekly: () => import("./diff-weekly.js").then(m => m.default),
  },
});
