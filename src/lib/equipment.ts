/** Seed defaults for a fresh install / migration fallback — see Equipment in
 * types.ts for the actual user-editable lists (Equipment screen). The original
 * hardcoded setup (before Equipment existed) was a 3 lb and a 10 lb dumbbell
 * pair — no kettlebells — so that's what a pre-Equipment snapshot migrates to. */
export const DEFAULT_OWNED_DUMBBELLS = [3, 10];
export const DEFAULT_OWNED_KETTLEBELLS: number[] = [];

/**
 * Resistance bands actually owned, and each one's equivalent weight in lbs.
 * This is a fixed property of the bands themselves, not a per-exercise guess —
 * combining bands sums their weights (see computeBandWeight).
 */
export const BAND_WEIGHTS: Record<string, number> = {
  yellow: 10,
  green: 20,
  blue: 30,
  black: 40,
  red: 50,
};

export const BAND_COLORS = Object.keys(BAND_WEIGHTS);

/** Swatch colors for the band picker UI. "black" is a dark grey stand-in so
 * the circle stays visible against this app's dark background. */
export const BAND_HEX: Record<string, string> = {
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  black: "#52525b",
  red: "#ef4444",
};

export function computeBandWeight(bands: string[]): number {
  return bands.reduce((total, color) => total + (BAND_WEIGHTS[color] ?? 0), 0);
}

/**
 * Picks the owned weight to grab for a warmup set targeting 50-75% of the
 * working weight. Prefers a weight that actually falls in range; if none does
 * (a real gap with a sparse set like 3s/10s), picks whichever owned weight is
 * numerically closest to the range, tie-breaking toward the lighter one —
 * warming up light is safer than warming up heavy.
 */
export function pickWarmupWeight(workingLbs: number, owned: number[]): number {
  if (owned.length === 0) return 0;
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

/** Every combination of owned bands (including none, for the bodyweight-equivalent
 * case), used by pickWarmupBand to search for the best warmup combo the same way
 * a working set's band combo is chosen — by total resistance, not by color. */
function bandCombinations(owned: string[]): string[][] {
  return owned.reduce<string[][]>((combos, color) => [...combos, ...combos.map((c) => [...c, color])], [[]]);
}

/**
 * Band equivalent of pickWarmupWeight: picks the combo of owned bands whose
 * combined resistance best targets 50-75% of the working combo's weight.
 * Same preference order — a combo actually in range, or the numerically
 * closest one, tying toward fewer bands (simpler to grab) then lighter
 * (safer to be off in that direction).
 */
export function pickWarmupBand(workingBands: string[], owned: string[]): string[] {
  const workingLbs = computeBandWeight(workingBands);
  const lo = workingLbs * 0.5;
  const hi = workingLbs * 0.75;

  const candidates = bandCombinations(owned).map((combo) => ({ combo, weight: computeBandWeight(combo) }));

  const inRange = candidates.filter((c) => c.weight >= lo && c.weight <= hi);
  const pool = inRange.length > 0 ? inRange : candidates;
  const distance = (weight: number) => (inRange.length > 0 ? 0 : weight < lo ? lo - weight : weight - hi);

  return pool.reduce((best, c) => {
    const d = distance(c.weight);
    const bestD = distance(best.weight);
    if (inRange.length > 0) {
      // Among in-range combos, prefer the heaviest (mirrors pickWarmupWeight).
      if (c.weight !== best.weight) return c.weight > best.weight ? c : best;
    } else if (d !== bestD) {
      return d < bestD ? c : best;
    }
    if (c.combo.length !== best.combo.length) return c.combo.length < best.combo.length ? c : best;
    return c.weight < best.weight ? c : best;
  }).combo;
}
