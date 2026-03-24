import { describe, test, expect } from "bun:test";
import {
  stripHtml, sanitizeText, escapeTemplateVars,
  escapeSlackMrkdwn, sanitizePathComponent, validateDate,
  wrapUntrustedContent,
} from "../../src/sanitize/index.js";

describe("stripHtml", () => {
  test("removes basic HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
  test("handles entity-encoded HTML", () => {
    const result = stripHtml("Hello &amp; world");
    expect(result).not.toContain("<script>");
  });
  test("strips script tags", () => {
    expect(stripHtml("<script>alert(1)</script>Safe")).toBe("Safe");
  });
  test("strips SVG with event handlers", () => {
    expect(stripHtml('<svg onload="alert(1)">text</svg>')).not.toContain("onload");
  });
  test("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
  test("preserves plain text", () => {
    expect(stripHtml("No HTML here")).toBe("No HTML here");
  });
});

describe("sanitizeText", () => {
  test("removes null bytes", () => {
    expect(sanitizeText("hello\0world")).toBe("helloworld");
  });
  test("removes control characters", () => {
    expect(sanitizeText("hello\x01\x02\x03world")).toBe("helloworld");
  });
  test("preserves newlines and tabs", () => {
    expect(sanitizeText("hello\n\tworld")).toBe("hello\n\tworld");
  });
  test("preserves normal text", () => {
    expect(sanitizeText("Hello, world!")).toBe("Hello, world!");
  });
});

describe("escapeTemplateVars", () => {
  test("escapes {{ to { {", () => {
    expect(escapeTemplateVars("{{persona}}")).toBe("{ {persona} }");
  });
  test("escapes multiple occurrences", () => {
    expect(escapeTemplateVars("{{a}} and {{b}}")).toBe("{ {a} } and { {b} }");
  });
  test("leaves single braces alone", () => {
    expect(escapeTemplateVars("{hello}")).toBe("{hello}");
  });
  test("handles text without braces", () => {
    expect(escapeTemplateVars("no braces")).toBe("no braces");
  });
});

describe("escapeSlackMrkdwn", () => {
  test("escapes angle brackets", () => {
    expect(escapeSlackMrkdwn("<script>")).toBe("&lt;script&gt;");
  });
  test("escapes ampersand", () => {
    expect(escapeSlackMrkdwn("A & B")).toBe("A &amp; B");
  });
  test("prevents user mention injection", () => {
    const result = escapeSlackMrkdwn("<@U123456|admin>");
    expect(result).not.toContain("<@");
  });
  test("prevents link injection", () => {
    const result = escapeSlackMrkdwn("<https://evil.com|Click me>");
    expect(result).not.toContain("<https");
  });
});

describe("sanitizePathComponent", () => {
  test("removes path traversal", () => {
    expect(sanitizePathComponent("../../../etc/passwd")).not.toContain("..");
  });
  test("removes slashes", () => {
    expect(sanitizePathComponent("a/b\\c")).toBe("abc");
  });
  test("removes null bytes", () => {
    expect(sanitizePathComponent("hello\0world")).toBe("helloworld");
  });
  test("removes leading dots", () => {
    expect(sanitizePathComponent(".hidden")).toBe("hidden");
  });
  test("preserves valid names", () => {
    expect(sanitizePathComponent("my-source-1")).toBe("my-source-1");
  });
  test("limits length to 255", () => {
    const long = "a".repeat(300);
    expect(sanitizePathComponent(long).length).toBe(255);
  });
});

describe("validateDate", () => {
  test("accepts valid date", () => {
    expect(validateDate("2026-03-24")).toBe("2026-03-24");
  });
  test("rejects invalid format", () => {
    expect(() => validateDate("2026/03/24")).toThrow();
  });
  test("rejects invalid month", () => {
    expect(() => validateDate("2026-13-01")).toThrow();
  });
  test("rejects invalid day", () => {
    expect(() => validateDate("2026-03-32")).toThrow();
  });
  test("rejects non-date string", () => {
    expect(() => validateDate("not-a-date")).toThrow();
  });
});

describe("wrapUntrustedContent", () => {
  test("wraps content with boundary markers", () => {
    const result = wrapUntrustedContent("title", "Hello World");
    expect(result).toContain('<source_data field="title">');
    expect(result).toContain("</source_data>");
    expect(result).toContain("Hello World");
  });
  test("escapes template vars in content", () => {
    const result = wrapUntrustedContent("title", "{{persona}} override");
    expect(result).not.toContain("{{persona}}");
    expect(result).toContain("{ {persona} }");
  });
  test("sanitizes control characters", () => {
    const result = wrapUntrustedContent("text", "hello\0\x01world");
    expect(result).not.toContain("\0");
  });
});
