import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "list",
    description: "List resources",
  },
  subCommands: {
    digests: () => import("./list-digests.js").then(m => m.default),
  },
});
