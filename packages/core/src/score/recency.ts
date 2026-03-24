/**
 * Score recency using exponential decay.
 *
 * Items published at windowEnd get score 1.0.
 * Items published at windowStart (windowEnd - windowDays) get score ~0.3.
 * Uses: score = exp(-lambda * daysSinceEnd)
 * where lambda is calibrated so exp(-lambda * windowDays) ≈ 0.3.
 */
export function scoreRecency(
  publishedAt: string,
  windowEnd: string,
  windowDays: number,
): number {
  const publishedMs = new Date(publishedAt).getTime();
  const endMs = new Date(windowEnd).getTime();

  const daysSinceEnd = (endMs - publishedMs) / (1000 * 60 * 60 * 24);

  // If published after the window end, treat as max recency
  if (daysSinceEnd <= 0) {
    return 1.0;
  }

  // If published before the window start, treat as minimum recency
  if (daysSinceEnd > windowDays) {
    return 0;
  }

  // Calibrate lambda so that exp(-lambda * windowDays) ≈ 0.3
  // -lambda * windowDays = ln(0.3)
  // lambda = -ln(0.3) / windowDays
  const lambda = -Math.log(0.3) / windowDays;
  const score = Math.exp(-lambda * daysSinceEnd);

  return Math.min(1, Math.max(0, score));
}
