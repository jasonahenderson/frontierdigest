const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "twclid",
  "ref",
  "ref_src",
  "ref_url",
  "mc_cid",
  "mc_eid",
  "oly_anon_id",
  "oly_enc_id",
  "_ga",
  "_gl",
  "s_cid",
  "vero_id",
  "igshid",
]);

export function canonicalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // If URL is invalid, return it as-is
    return url;
  }

  // Normalize protocol to https
  if (parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }

  // Remove www. prefix
  if (parsed.hostname.startsWith("www.")) {
    parsed.hostname = parsed.hostname.slice(4);
  }

  // Lowercase hostname (URL constructor usually does this, but be explicit)
  parsed.hostname = parsed.hostname.toLowerCase();

  // Strip tracking parameters
  const params = new URLSearchParams(parsed.search);
  const keysToDelete: string[] = [];
  for (const key of params.keys()) {
    if (TRACKING_PARAMS.has(key) || key.startsWith("utm_")) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    params.delete(key);
  }

  // Sort remaining query params
  params.sort();

  // Rebuild search string
  const sortedSearch = params.toString();
  parsed.search = sortedSearch ? `?${sortedSearch}` : "";

  // Remove trailing slash from pathname (but keep root "/")
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  // Remove hash fragment
  parsed.hash = "";

  return parsed.toString();
}
