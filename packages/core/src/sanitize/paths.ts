import { resolve, relative } from "node:path";

/**
 * Validate that a config file path doesn't escape the project directory.
 * Resolves the path and checks it stays within the allowed boundary.
 */
export function validateConfigPath(input: string, cwd?: string): string {
  const base = resolve(cwd ?? process.cwd());
  const resolved = resolve(base, input);

  // Check the resolved path is within the base directory
  const rel = relative(base, resolved);
  if (rel.startsWith("..") || resolve(rel) === resolved) {
    // rel starts with ".." means it escaped, or it's an absolute path
    // Allow absolute paths only if they're within the base
    if (!resolved.startsWith(base)) {
      throw new Error(
        `Config path "${input}" resolves outside the project directory. ` +
        `Resolved: ${resolved}, Project: ${base}`
      );
    }
  }

  return resolved;
}

/**
 * Validate that an output path stays within the allowed directory.
 */
export function validateOutputPath(input: string, allowedDir: string): string {
  const base = resolve(allowedDir);
  const resolved = resolve(base, input);
  const rel = relative(base, resolved);

  if (rel.startsWith("..")) {
    throw new Error(
      `Output path "${input}" escapes allowed directory "${allowedDir}"`
    );
  }

  return resolved;
}
