const DEFAULT_SHINGLE_SIZE = 3;

/**
 * Simple non-crypto hash for a string, returning a 32-bit unsigned integer.
 * Uses FNV-1a for speed and reasonable distribution.
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Generate a simhash-style fingerprint from text content using word shingles.
 *
 * @param text - The text to fingerprint
 * @param shingleSize - Number of words per shingle (default 3)
 * @returns A 32-character hex string fingerprint
 */
export function contentFingerprint(
  text: string,
  shingleSize?: number,
): string {
  const size = shingleSize ?? DEFAULT_SHINGLE_SIZE;

  // Normalize text: lowercase, collapse whitespace, strip punctuation
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(" ").filter((w) => w.length > 0);

  if (words.length < size) {
    // Not enough words for shingles; hash the whole text
    const hash = fnv1aHash(normalized);
    return hash.toString(16).padStart(8, "0").repeat(4);
  }

  // Generate shingles and compute simhash
  // Use 128-bit simhash (4 x 32-bit components)
  const components = 4;
  const bits = 32;
  const vectors: number[][] = Array.from({ length: components }, () =>
    new Array(bits).fill(0),
  );

  for (let i = 0; i <= words.length - size; i++) {
    const shingle = words.slice(i, i + size).join(" ");

    // Hash the shingle multiple times for each component
    for (let c = 0; c < components; c++) {
      const hash = fnv1aHash(shingle + String(c));
      for (let bit = 0; bit < bits; bit++) {
        if ((hash >> bit) & 1) {
          vectors[c][bit]++;
        } else {
          vectors[c][bit]--;
        }
      }
    }
  }

  // Convert vectors to hash
  let result = "";
  for (let c = 0; c < components; c++) {
    let value = 0;
    for (let bit = 0; bit < bits; bit++) {
      if (vectors[c][bit] > 0) {
        value |= 1 << bit;
      }
    }
    result += (value >>> 0).toString(16).padStart(8, "0");
  }

  return result;
}

/**
 * Compare two fingerprints and return a 0-1 similarity score.
 * Based on the proportion of matching bits.
 */
export function fingerprintSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length !== b.length) return 0;

  // Parse hex strings into bits and compare
  const totalBits = a.length * 4; // each hex char = 4 bits
  let matchingBits = 0;

  for (let i = 0; i < a.length; i++) {
    const va = parseInt(a[i], 16);
    const vb = parseInt(b[i], 16);
    const xor = va ^ vb;
    // Count matching bits (4 - popcount of xor)
    let diffBits = 0;
    let x = xor;
    while (x) {
      diffBits += x & 1;
      x >>= 1;
    }
    matchingBits += 4 - diffBits;
  }

  return matchingBits / totalBits;
}
