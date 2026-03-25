import { defineGroup } from "../helpers/define-group.js";

export default defineGroup(
  { name: "list", description: "List resources" },
  {
    digests: () => import("./list-digests.js").then(m => m.default),
  },
);
