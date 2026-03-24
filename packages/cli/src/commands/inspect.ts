import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "inspect",
    description: "Inspect pipeline artifacts",
  },
  subCommands: {
    run: () => import("./inspect-run.js").then(m => m.default),
  },
});
