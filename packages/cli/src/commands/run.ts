import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "run", description: "Run the full pipeline" },
  {
    weekly: () => import("./run-weekly.js").then(m => m.default),
  },
);
