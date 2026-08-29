/** Seed defaults for a fresh install / migration fallback — see Equipment in
 * types.ts for the actual user-editable lists (Equipment screen). The original
 * hardcoded setup (before Equipment existed) was a 3 lb and a 10 lb dumbbell
 * pair — no kettlebells — so that's what a pre-Equipment snapshot migrates to. */
export const DEFAULT_OWNED_DUMBBELLS = [3, 10];
export const DEFAULT_OWNED_KETTLEBELLS: number[] = [];
export const DEFAULT_OWNED_LOOP_BANDS = ["light", "moderate", "strong"];

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
 * Closed-loop bands (e.g. for lateral band walks) — a separate, smaller
 * catalog from the tube BAND_WEIGHTS above, and often worn multiple at once
 * (see computeLoopBandWeight). "strong" reuses the same dark-grey stand-in as
 * tube "black" — same reasoning: true black wouldn't read against this app's
 * background.
 */
export const LOOP_BAND_STRENGTHS = ["light", "moderate", "strong"];

export const LOOP_BAND_HEX: Record<string, string> = {
  light: "#9ca3af",
  moderate: "#3b82f6",
  strong: "#52525b",
};

/** Loop bands have no real weight, only a relative ordering — this ordinal
 * rank (1/2/3) stands in for weight wherever combined strength needs to be
 * compared or summed (warmup range-search), the same role BAND_WEIGHTS plays
 * for tube bands, just not a physical lbs value. */
const LOOP_BAND_RANK: Record<string, number> = { light: 1, moderate: 2, strong: 3 };

export function computeLoopBandWeight(strengths: string[]): number {
  return strengths.reduce((total, s) => total + (LOOP_BAND_RANK[s] ?? 0), 0);
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

/** Every combination of an owned set (including none, for the bodyweight-equivalent
 * case) — shared by pickWarmupBand and pickWarmupLoopBand to search for the best
 * warmup combo the same way a working set's combo is chosen: by total resistance,
 * not by which specific colors/strengths. */
function combinations(owned: string[]): string[][] {
  return owned.reduce<string[][]>((combos, item) => [...combos, ...combos.map((c) => [...c, item])], [[]]);
}

/**
 * Shared core of pickWarmupBand/pickWarmupLoopBand: picks the combo of owned
 * items whose combined weight (via weightFn) best targets 50-75% of the
 * working combo's weight. Prefers a combo actually in range (the heaviest
 * one, mirroring pickWarmupWeight), or the numerically closest one, tying
 * toward fewer items (simpler to grab) then lighter (safer to be off in that
 * direction).
 */
function pickWarmupCombo(workingWeight: number, owned: string[], weightFn: (combo: string[]) => number): string[] {
  const lo = workingWeight * 0.5;
  const hi = workingWeight * 0.75;

  const candidates = combinations(owned).map((combo) => ({ combo, weight: weightFn(combo) }));

  const inRange = candidates.filter((c) => c.weight >= lo && c.weight <= hi);
  const pool = inRange.length > 0 ? inRange : candidates;
  const distance = (weight: number) => (inRange.length > 0 ? 0 : weight < lo ? lo - weight : weight - hi);

  return pool.reduce((best, c) => {
    const d = distance(c.weight);
    const bestD = distance(best.weight);
    if (inRange.length > 0) {
      if (c.weight !== best.weight) return c.weight > best.weight ? c : best;
    } else if (d !== bestD) {
      return d < bestD ? c : best;
    }
    if (c.combo.length !== best.combo.length) return c.combo.length < best.combo.length ? c : best;
    return c.weight < best.weight ? c : best;
  }).combo;
}

export function pickWarmupBand(workingBands: string[], owned: string[]): string[] {
  return pickWarmupCombo(computeBandWeight(workingBands), owned, computeBandWeight);
}

/** Loop-band equivalent of pickWarmupBand: same combo search, using ordinal
 * rank (computeLoopBandWeight) in place of real lbs. A working ["moderate"]
 * with all three owned resolves to ["light"] — one level lighter, matching
 * how the other warmup computations already work. */
export function pickWarmupLoopBand(workingStrengths: string[], owned: string[]): string[] {
  return pickWarmupCombo(computeLoopBandWeight(workingStrengths), owned, computeLoopBandWeight);
}
