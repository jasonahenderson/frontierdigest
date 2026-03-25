import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "inspect", description: "Inspect pipeline artifacts" },
  {
    run: () => import("./inspect-run.js").then(m => m.default),
  },
);
