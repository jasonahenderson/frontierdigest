import { defineCommand, runMain, type CommandDef, type SubCommandsDef } from "citty";

/**
 * Define a command group that shows help when invoked without a subcommand.
 */
export function defineGroup(meta: { name: string; description: string }, subCommands: SubCommandsDef) {
  const cmd: ReturnType<typeof defineCommand> = defineCommand({
    meta,
    run() {
      runMain(cmd, { rawArgs: ["--help"] });
    },
    subCommands,
  });
  return cmd;
}
