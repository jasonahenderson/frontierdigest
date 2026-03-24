import { describe, test, expect } from "bun:test";
import { canonicalizeUrl } from "../../src/normalize/url-canonical.js";

describe("canonicalizeUrl", () => {
  test("strips utm_* tracking parameters", () => {
    const url =
      "https://example.com/article?utm_source=twitter&utm_medium=social&utm_campaign=spring";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/article");
  });

  test("strips additional utm_ params beyond the standard set", () => {
    const url = "https://example.com/article?utm_custom_param=foo&title=hello";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/article?title=hello");
  });

  test("strips fbclid, gclid, and other click tracking params", () => {
    const url = "https://example.com/page?fbclid=abc123&gclid=def456&key=val";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/page?key=val");
  });

  test("removes www. prefix", () => {
    const url = "https://www.example.com/article";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/article");
  });

  test("normalizes http to https", () => {
    const url = "http://example.com/article";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/article");
  });

  test("removes trailing slashes from paths (but keeps root /)", () => {
    expect(canonicalizeUrl("https://example.com/article/")).toBe(
      "https://example.com/article",
    );
    // Root path should keep its single slash
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  test("sorts query parameters alphabetically", () => {
    const url = "https://example.com/search?z=1&a=2&m=3";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/search?a=2&m=3&z=1");
  });

  test("removes hash fragments", () => {
    const url = "https://example.com/article#section-2";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/article");
  });

  test("lowercases hostname", () => {
    const url = "https://EXAMPLE.COM/Article";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/Article");
  });

  test("handles URLs with no query string", () => {
    const url = "https://example.com/simple-path";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/simple-path");
  });

  test("returns malformed URLs as-is", () => {
    const malformed = "not-a-valid-url";
    const result = canonicalizeUrl(malformed);
    expect(result).toBe("not-a-valid-url");
  });

  test("handles empty string gracefully", () => {
    const result = canonicalizeUrl("");
    expect(result).toBe("");
  });

  test("combines multiple normalizations at once", () => {
    const url =
      "http://www.EXAMPLE.com/blog/post/?utm_source=newsletter&ref=homepage&id=42#comments";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/blog/post?id=42");
  });

  test("preserves non-tracking query params", () => {
    const url = "https://example.com/search?q=ai+agents&page=2&utm_source=google";
    const result = canonicalizeUrl(url);
    expect(result).toBe("https://example.com/search?page=2&q=ai+agents");
  });
});
