import { describe, test, expect } from "bun:test";
import {
  titleSimilarity,
  generateTrigrams,
  diceCoefficient,
} from "../../src/dedupe/similarity.js";

describe("generateTrigrams", () => {
  test("generates correct trigrams for a short string", () => {
    const trigrams = generateTrigrams("hello");
    expect(trigrams.has("hel")).toBe(true);
    expect(trigrams.has("ell")).toBe(true);
    expect(trigrams.has("llo")).toBe(true);
    expect(trigrams.size).toBe(3);
  });

  test("normalizes input to lowercase", () => {
    const upper = generateTrigrams("HELLO");
    const lower = generateTrigrams("hello");
    expect(upper).toEqual(lower);
  });

  test("collapses whitespace before generating trigrams", () => {
    const spaced = generateTrigrams("a  b  c");
    const compact = generateTrigrams("a b c");
    expect(spaced).toEqual(compact);
  });

  test("returns empty set for strings shorter than 3 characters", () => {
    expect(generateTrigrams("ab").size).toBe(0);
    expect(generateTrigrams("a").size).toBe(0);
    expect(generateTrigrams("").size).toBe(0);
  });
});

describe("diceCoefficient", () => {
  test("returns 1 for two identical sets", () => {
    const a = new Set(["abc", "bcd", "cde"]);
    const b = new Set(["abc", "bcd", "cde"]);
    expect(diceCoefficient(a, b)).toBe(1);
  });

  test("returns 0 for two completely disjoint sets", () => {
    const a = new Set(["abc", "bcd"]);
    const b = new Set(["xyz", "yza"]);
    expect(diceCoefficient(a, b)).toBe(0);
  });

  test("returns 1 for two empty sets", () => {
    const a = new Set<string>();
    const b = new Set<string>();
    expect(diceCoefficient(a, b)).toBe(1);
  });

  test("returns 0 when one set is empty and the other is not", () => {
    const a = new Set<string>();
    const b = new Set(["abc"]);
    expect(diceCoefficient(a, b)).toBe(0);
    expect(diceCoefficient(b, a)).toBe(0);
  });

  test("computes correct score for partial overlap", () => {
    const a = new Set(["abc", "bcd", "cde", "def"]);
    const b = new Set(["abc", "bcd", "xyz", "yza"]);
    // intersection = 2, |a| = 4, |b| = 4
    // dice = 2 * 2 / (4 + 4) = 0.5
    expect(diceCoefficient(a, b)).toBe(0.5);
  });
});

describe("titleSimilarity", () => {
  test("returns 1.0 for identical titles", () => {
    const title = "New Advances in Long-Context Agent Memory Systems";
    expect(titleSimilarity(title, title)).toBe(1);
  });

  test("returns approximately 0 for completely different titles", () => {
    const a = "New Advances in Long-Context Agent Memory Systems";
    const b = "DeFi Protocols Integrate On-Chain Trading";
    const score = titleSimilarity(a, b);
    expect(score).toBeLessThan(0.3);
  });

  test("returns high score for similar titles with minor differences", () => {
    const a = "Context Engineering Best Practices for Production Systems";
    const b = "Context Engineering Practices for Production LLM Apps";
    const score = titleSimilarity(a, b);
    expect(score).toBeGreaterThan(0.5);
  });

  test("is case insensitive", () => {
    const a = "Hello World Test Title";
    const b = "hello world test title";
    expect(titleSimilarity(a, b)).toBe(1);
  });

  test("returns 1.0 for two empty strings", () => {
    expect(titleSimilarity("", "")).toBe(1);
  });

  test("returns 0 for one empty and one non-empty string", () => {
    expect(titleSimilarity("hello world foo", "")).toBe(0);
    expect(titleSimilarity("", "hello world foo")).toBe(0);
  });

  test("handles strings with only whitespace", () => {
    // After normalization, "   " becomes "" (trimmed), so trigrams will be empty
    expect(titleSimilarity("   ", "   ")).toBe(1);
  });
});
