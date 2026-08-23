/**
 * Free weights actually owned at home (each owned as a pair), in lbs.
 * Hardcoded for now — no settings screen to edit this yet.
 */
export const OWNED_FREE_WEIGHTS = [3, 10];

/**
 * Picks the owned weight to grab for a warmup set targeting 50-75% of the
 * working weight. Prefers a weight that actually falls in range; if none does
 * (a real gap with a sparse set like 3s/10s), picks whichever owned weight is
 * numerically closest to the range, tie-breaking toward the lighter one —
 * warming up light is safer than warming up heavy.
 */
export function pickWarmupWeight(workingLbs: number, owned: number[] = OWNED_FREE_WEIGHTS): number {
  const lo = workingLbs * 0.5;
  const hi = workingLbs * 0.75;

  const inRange = owned.filter((w) => w >= lo && w <= hi);
  if (inRange.length > 0) return Math.max(...inRange);

  const distance = (w: number) => (w < lo ? lo - w : w - hi);
  return owned.reduce((best, w) => {
    const d = distance(w);
    const bestD = distance(best);
    if (d < bestD) return w;
    if (d === bestD) return Math.min(w, best);
    return best;
  });
}
