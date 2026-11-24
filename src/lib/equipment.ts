/** Seed defaults for a fresh install / migration fallback — see Equipment in
 * types.ts for the actual user-editable lists (Equipment screen). The original
 * hardcoded setup (before Equipment existed) was a 3 lb and a 10 lb dumbbell
 * pair — no kettlebells — so that's what a pre-Equipment snapshot migrates to. */
export const DEFAULT_OWNED_DUMBBELLS = [3, 10];
export const DEFAULT_OWNED_KETTLEBELLS: number[] = [];
export const DEFAULT_OWNED_LOOP_BANDS = ["light", "moderate", "strong"];

/**
 * Closed-loop bands (e.g. for lateral band walks) — a separate, smaller
 * catalog, and often worn multiple at once (see computeLoopBandWeight).
 * "strong" is a dark-grey stand-in: true black wouldn't read against this
 * app's background.
 */
export const LOOP_BAND_STRENGTHS = ["light", "moderate", "strong"];

export const LOOP_BAND_HEX: Record<string, string> = {
  light: "#9ca3af",
  moderate: "#3b82f6",
  strong: "#52525b",
};

/** Loop bands have no real weight, only a relative ordering — this ordinal
 * rank (1/2/3) stands in for weight wherever combined strength needs to be
 * compared or summed (warmup range-search) — not a physical lbs value. */
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
 * case) — used by pickWarmupLoopBand to search for the best
 * warmup combo the same way a working set's combo is chosen: by total resistance,
 * not by which specific colors/strengths. */
function combinations(owned: string[]): string[][] {
  return owned.reduce<string[][]>((combos, item) => [...combos, ...combos.map((c) => [...c, item])], [[]]);
}

/**
 * Picks the combo of owned
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

/** Picks the loop-band combo to warm up with: a combo search by ordinal rank
 * (computeLoopBandWeight), since loop bands have no real lbs. A working ["moderate"]
 * with all three owned resolves to ["light"] — one level lighter, matching
 * how the other warmup computations already work. */
export function pickWarmupLoopBand(workingStrengths: string[], owned: string[]): string[] {
  return pickWarmupCombo(computeLoopBandWeight(workingStrengths), owned, computeLoopBandWeight);
}
