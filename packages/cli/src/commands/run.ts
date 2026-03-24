import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "run",
    description: "Run the full pipeline",
  },
  subCommands: {
    weekly: () => import("./run-weekly.js").then(m => m.default),
  },
});
