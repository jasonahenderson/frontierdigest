/**
 * Generate character trigrams from a string.
 */
export function generateTrigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const trigrams = new Set<string>();

  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }

  return trigrams;
}

/**
 * Compute the Dice coefficient between two sets.
 * Returns 0-1 similarity score.
 */
export function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersection++;
    }
  }

  return (2 * intersection) / (a.size + b.size);
}

/**
 * Compute title similarity using Dice coefficient on character trigrams.
 * Returns 0-1 similarity score.
 */
export function titleSimilarity(a: string, b: string): number {
  const trigramsA = generateTrigrams(a);
  const trigramsB = generateTrigrams(b);
  return diceCoefficient(trigramsA, trigramsB);
}
