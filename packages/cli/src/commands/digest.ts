import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "digest",
    description: "Generate digests",
  },
  subCommands: {
    weekly: () => import("./digest-weekly.js").then(m => m.default),
  },
});
