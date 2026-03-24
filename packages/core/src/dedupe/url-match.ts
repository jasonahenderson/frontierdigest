import { canonicalizeUrl } from "../normalize/url-canonical.js";

/**
 * Compare two URLs for exact match after canonicalization.
 */
export function urlsMatch(a: string, b: string): boolean {
  return canonicalizeUrl(a) === canonicalizeUrl(b);
}
