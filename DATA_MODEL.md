# Data Model

This describes the schema used in [`seed-data.json`](src/data/seed-data.json).

## Scope: strength/resistance exercises only

This app tracks the strength/resistance workout your trainer shares. PT/shoulder-rehab exercises live in a separate app for now, so there's no `category` field or PT-specific schema here — building that out now would just be guessing at a shape with no real data to check it against. When you're ready to bring PT tracking into this app, we'll design that schema then, against an actual PT note.

## Core principle: definitions vs. workouts

The trainer's note conflates two things that change at very different rates:

- **What an exercise *is*** (name, target weight/reps, form cues, links) — changes rarely.
- **The workout structure** (which exercises, in what superset order, with what rest/set protocol) — reusable across multiple workout notes.

If weight/reps were copied into every workout that uses an exercise, the same exercise would drift out of sync the moment you update it in one place and not another. So there's exactly one place "5 lbs for 15 each side" lives: the exercise definition. Workouts reference exercises **by id** and never carry weight/reps themselves.

```
exercises[]   <-- one source of truth per exercise (target weight, reps, cues, links)
workouts[]    <-- superset structure + protocol, referencing exercise ids only
```

## `exercises[]`

```
id              stable slug, used as the foreign key from workouts[] and progression[]
name
target          current prescribed load/reps — what the app should remind you to do
cues            string[] of form notes
tags            string[] — freeform (e.g. "legs", "core"), powers the exercise picker's search
warmup          string | null — free-text warm-up prescription (fallback, see warmupSpec below)
warmupSpec      { reps, percentRange } | undefined — see "Computed warmup weight" below
progressionRule string | null — the trainer's rule for when/how much to increase
links           { instructional?, video? } — only populated when the source note had a URL
progression     [] — see below
```

### `tags`

Deliberately freeform rather than a fixed taxonomy (`["legs", "arms", "core", ...]`) — you're the only one ever tagging an exercise, so there's no real risk of tags fragmenting into unmanageable synonyms, and a fixed list would mean maintaining an enum for a 7-exercise library. Search (in the Create New Home Workout exercise picker) does a plain case-insensitive substring match against name *and* tags, so "ar" matches both an "arm"-tagged and an "arms"-tagged exercise without needing them reconciled into one spelling. Editable after creation via Edit Exercise Details, same add/remove pattern as `cues`.

### Computed warmup weight

The trainer's note prescribes warmups as "50-75% of working weight," which is fine as a rule but useless as an instruction when you're standing there mid-workout — it requires doing math, then finding a weight that doesn't actually exist in a 3lb/10lb set. So this is computed for every exercise, not read as a vague percentage:

```
warmupReps: number | null;                              // rep count; null means no warmup at all
warmupLoad: Load | { left: Load; right: Load } | null;  // null = linked (computed); set = independent
```

`warmupLoad` is null by default — "linked" — meaning warmup is always computed live as 50-75% of whatever `target.load` (or, for asymmetric exercises, `target.sides.left/right.load`) currently is. `getWarmupLines()` finds the closest thing to actually grab from owned equipment:

- **Free weight:** `pickWarmupWeight()` picks whichever owned dumbbell or kettlebell (the Equipment screen — see `## equipment` below) best satisfies the range — the heaviest one that actually falls inside it, or if none do (a real gap in a sparse set), the closest one, tie-breaking toward lighter as the safer direction to be off in.
- **Band:** `pickWarmupBand()` does the same search over every combination of owned bands (see `BAND_WEIGHTS`/`BAND_COLORS`), by total resistance rather than color — same in-range/closest preference, with an added tie-break toward fewer bands (simpler to grab) before falling back to lighter.
- **Loop band:** `pickWarmupLoopBand()` shares its combo-search core with `pickWarmupBand()` (see `Load` above), just summing ordinal ranks instead of real lbs — a working `["moderate"]` resolves to `["light"]` when all three are owned, one level lighter.
- **Bodyweight** (or no load) has nothing to scale — it warms up as bodyweight too, which falls out of the math rather than needing a special case.
- **Asymmetric exercises** (`target.sides`) compute each side independently and show both, the same way the working line does — a single number would misrepresent two genuinely different targets.

Setting `warmupLoad` "unlinks" it: an independent `Load` (or, for an asymmetric exercise, a `{ left, right }` pair) takes over instead, edited in Edit Mode the same way as the working target — see §5 in `PRD.md`. This is the escape hatch for whenever 50-75% shouldn't apply, and it's what makes the rule safe to apply everywhere rather than needing a per-exercise flag for exceptions: an exception is just an unlink. Unlike the working `target`, an unlinked `warmupLoad` never generates a `progression[]` entry — warmup isn't a tracked metric, just a convenience.

An earlier version of this made `warmupLoad` a free-text override (`warmup: string | null`) instead of a structured `Load` — simpler to store, but it meant warmup could only ever be *read*, not edited through the same weight/band controls as everything else. Real use surfaced that as a real gap ("I don't love that you can't edit the warmup, that it's all computed whether you want it or not"), so it was replaced with a structured value editable the same way as `target.load`.

**`warmupReps: null` is shown, not hidden.** An exercise with no warmup at all (Same Side Dead-Bugs) still gets a Warmup section — it just reads "None required" instead of a computed line, and isn't a tap target (there's no weight to edit when none applies). An earlier version omitted the section entirely for these exercises, which read as broken rather than intentional once the rest of the workout consistently showed both Warmup and Working side by side.

**Not every real distinction is a `Load`.** Single Leg Standing 8-Point Leg Reaches warms up and works at the identical `Bodyweight x 1` — the actual difference between the two (reach a shorter distance on warmup, further on working) is about distance, which isn't a quantity this app tracks anywhere. Rather than inventing a field for one exercise's nuance, that distinction is carried as a form cue instead — the same free-text mechanism this exercise's `progressionRule` ("Increase distance of the reaching leg") already relies on.

**A real bug this design fixed:** Single Leg Deadlift's original seed data said its warmup was "bodyweight" — accurate when the note was first transcribed (the working weight *was* bodyweight then), but the trainer's actual rule was "50% of working weight," and the working weight has since progressed to 10 lbs without the warmup text ever being updated to match. Computing it live instead of freezing it as text is what prevents this class of staleness going forward.

**Migration backfill:** `loadData()` fills a still-null `warmupReps` from the current seed file's default for a matching exercise id. This exists because `saveExercise()` rewrites every exercise's shape on any single save (not just the one being edited), so there's no reliable way to tell "this record predates `warmupReps`" apart from "warmup was deliberately turned off" once even one unrelated exercise has been saved — both end up as `warmupReps: null`. Given this app has exactly one user and no one has yet had the chance to deliberately disable warmup on a stock exercise, backfilling from seed is the safe read today. If that stops being true, this needs a real "explicitly configured" marker instead of inferring intent from nullness.

Because this is computed from `target.load` live, it automatically stays correct as you progress — no separate warmup-weight field to keep in sync.

### `target`

```
target: {
  repRange: { min, max }       // the exercise's general prescribed range, e.g. 8-15 (metadata, not what gets edited)
  perSide: boolean             // true if reps/load are tracked per side
  reps: number | null          // the LIVE working-set target — what Edit Mode actually changes
  load: Load | null            // current target load, when symmetric
  sides: {                     // used INSTEAD of reps/load when the two
    left:  { load, reps },     // sides are asymmetric (see below)
    right: { load, reps }
  } | null
}
```

`repRange` and `reps` are easy to conflate — both are "a range of numbers" — so to be explicit: `repRange` is fixed exercise metadata (the trainer's stated range, doesn't change from editing), while `reps` is the single number Edit Mode actually writes to. An earlier pass let `reps` also be a range (e.g. "work toward 12-15") via a `RepsTarget = number | RepRange` union, with a min/max split in Edit Mode — that's been reverted. It added real complexity (keeping min ≤ max valid in the UI) for a use case that didn't earn it, so `reps` is back to a plain number everywhere: `target`, per-side targets, and `progression[]` entries alike.

### `Load`

Weight isn't always a plain number — the note mixes free weights and resistance bands (sometimes stacked, e.g. "red + blue"), so `Load` is a small tagged union:

```
{ kind: "freeWeight", lbs: number }
{ kind: "band", bands: string[] }
{ kind: "bodyweight" }
{ kind: "loopBand", strengths: ("light" | "moderate" | "strong")[] }
```

A band's equivalent weight isn't stored — it's a fixed property of the bands themselves (yellow=10, blue=20, green=30, black=40, red=50 lbs, owned pairs sum when stacked), computed on the fly by `computeBandWeight()` in `lib/equipment.ts` from whichever colors are in `bands[]`. Storing a number here would let it drift out of sync with the real bands; this way there's exactly one place the weight-per-color mapping lives, and every band-loaded exercise's displayed weight, history point, and edit-mode UI all derive from it. (Earlier drafts stored `equivalentLbs` as an independent, manually-set number, plus a `homeEquivalentLbs` for a "different bands at home" case — both are gone now that there's one canonical home band set with fixed weights.)

`loopBand` is a second, separate kind of band (e.g. Lateral Band Walks) — a closed loop, often worn multiple at once (e.g. light + strong together), so like `band` above it's an array rather than a single value; unlike `band`, though, there's no real lbs weight to sum, just an ordinal ranking (see `computeLoopBandWeight()`). Kept as its own `Load` kind (not folded into `band`) even though the two catalogs' color names happen to overlap ("blue", "black") — a loop band and a tube band are physically different equipment, and `Equipment.ownedLoopBands` is tracked separately from `ownedBands` for the same reason. Its warmup uses `pickWarmupLoopBand()` in `lib/equipment.ts`, which shares its combo-search core with `pickWarmupBand()`, substituting ordinal rank (light=1/moderate=2/strong=3) for real weight.

### Asymmetric sides: Resistance Band Curls & Single Arm Band Kick-Backs

These are the two exercises where left/right get genuinely different weight and reps rather than a symmetric number. That's not incidental — it's your trainer's shoulder-rehab plan: keep training the uninjured (right) arm normally, keep the left slow, light, and controlled. So instead of just storing a smaller number for the left side with no context, each of these exercises carries:

- `target.sides.left.tempo` — a cue that surfaces specifically on the rehab side (e.g. "slow and controlled - shoulder rehab side")
- `asymmetryNote` on the exercise itself, explaining *why* the two sides differ

The goal is that when the app reminds you of this exercise, it doesn't just show "left: 10 lbs" next to "right: 70 lbs" and leave you to remember why — the reasoning travels with the data.

For the other asymmetric-*capable* exercises (Side Lunges, Single Leg Deadlift), the two sides currently use the same weight/reps, so they use the flat `reps`/`load` fields instead of `sides`.

### `progression[]`

This is **not** a per-session workout log — you don't need to check in every time you do the workout. It's a lightweight log of the trainer's own dated notes on weight changes (e.g. Side Lunges: "6/25- used 6lbs", "7/24- used 10lbs", and the current value dated "7/28"). You'd add an entry here only when the target weight/reps actually changes, which is exactly what "track how the reps/weight goes up over time" needs — a timeline of target changes, not a diary of every workout instance.

```
{ date: "YYYY-MM-DD", load: Load | null, reps: number | null, note: string | null, side?: "left" | "right" }
```

**Assumption flagged:** the source note only gave month/day ("6/25", "7/24", "7/28"), no year. Since today's date is 2026-08-05 and those three dates fall in a plausible recent progression right before today, I inferred year **2026**. If the note is actually older than that, these dates need correcting.

**Not every entry is plottable.** The History screen (`lib/history.ts`) needs both a numeric weight and a numeric reps value to place a point — bodyweight entries have no weight axis, and some entries (the two seed entries above, and the one legacy note-only Band Curls entry) have `reps: null` or both fields `null`. Those are counted (`skippedCount`) and disclosed on the History screen rather than just vanishing, so the chart never looks like a more complete history than it is.

### Alternates

Superset 2's second exercise offers two options ("Lying Tricep Extensions **or** Single Arm Band Kick-Backs"). Both exist as separate exercise definitions, and the alternate carries `alternateFor: "lying-db-tricep-extension"` — keeps both as first-class exercises with their own targets/progression if you end up alternating between them.

### Omitted: pictures

The note contains embedded image placeholders (￼) with no filename, alt text, or URL — nothing extractable. `links` only includes `instructional`/`video` where an actual URL existed.

## `workouts[]`

A workout is the superset structure plus the shared protocol (sets, rest periods) — deliberately *not* per-exercise, since "2 working sets, 1 warm-up, rest 15-30s within superset, 60-90s between supersets" applies to the whole workout, not to any one exercise:

```
{
  id, name,
  type: "home" | "gym",
  structure: {
    dynamicStretching: string,   // pointer to the separate shared note, not duplicated
    protocol: { workingSets, warmupSets, restBetweenExercisesSec: {min,max}, restBetweenSupersetsSec: {min,max}, notes }
  },
  supersets: [
    { order, slots: [ { order, exerciseIds: [...] } ] }   // >1 id in exerciseIds = alternates
  ]
}
```

`slots[].exerciseIds` is an array (not a single id) so a slot can hold a primary exercise plus alternates (e.g. tricep-extension/kick-back) — the Workout Builder (PRD §9) reads and writes this array directly, so alternates added or removed there round-trip the same way as the seeded ones.

`type` distinguishes Home Workouts from Gym Workouts (PRD §2/§12) — the only thing it actually changes is whether the free-weight stepper applies `equipment.limitWeightToOwned` (a gym has a full rack, so it never does). Everything else — exercise catalog, builder, protocol, supersets — is identical between the two; `type` is fixed for a workout's lifetime, chosen at creation from which Home Screen tab was active and carried through the builder via `?type=gym`. Set to `"home"` by `loadData()`'s migration for any workout written before this field existed.

## `completions[]`

The "Log Workout" action's entire write — one entry per tap, nothing more:

```
{ workoutId: string, date: "YYYY-MM-DD" }
```

Deliberately separate from `exercises[].progression[]`: this tracks *that* a workout happened, not what happened inside it. "Last completed" on the Workout List is just the max date across a workout's entries — no separate "last completed" field to keep in sync, it's derived (`lib/completions.ts`).

Deleting a workout (from its edit screen) cascades to its completions — an entry pointing at a `workoutId` that no longer exists isn't history, it's a dangling reference, so `deleteWorkout()` removes both together.

Since this field didn't exist when earlier `localStorage` snapshots were written, `loadData()` defaults it to `[]` for anyone with pre-existing data rather than assuming it's always present — the only field so far that's needed this kind of migration handling (now shared with `notes[]` below, for the same reason).

## `notes[]`

Free-text guidance or observations on an exercise — not structured data, and not another progression/completion-style log:

```
{ id: string, exerciseId: string, text: string, createdAt: string, pinned: boolean }
```

`createdAt` is a **full ISO timestamp**, not just a date like `progression[]`/`completions[]` use — a deliberate difference. Those two only ever need one entry per real-world event (a target change, a workout), so date granularity is enough. Notes don't have that constraint: you could plausibly jot two separate observations on the same exercise in one sitting, and "most-recent-first" needs to actually resolve that correctly rather than leaving same-day notes in an arbitrary order. `lib/notes.ts`'s `notesForExercise()` does the sort: pinned notes first, then most-recent-first within each group.

Full CRUD now: add, edit text, pin/unpin, delete (with confirmation, since it's permanent). The first pass only had add and pin/unpin — delete turned out to be a real gap once notes were actually being used, not a speculative addition. Editing text never touches `createdAt`, so it can't silently reorder a note just because its wording got fixed.

## `equipment`

What's actually owned, feeding the computed-warmup logic in "Computed warmup weight" above — a single object, not a list, since there's exactly one home setup:

```
{ ownedDumbbells: number[], ownedKettlebells: number[], ownedBands: string[], ownedLoopBands: string[], limitWeightToOwned: boolean }
```

`ownedDumbbells` and `ownedKettlebells` are both plain, user-editable lists of lbs values — kept separate because they carry a different real-world assumption: a dumbbell entry means an owned *pair* (enter "10" for a 10 lb pair, not the combined 20), while a kettlebell entry means one. `ownedBands` is a subset of the fixed color catalog in `BAND_WEIGHTS`/`BAND_COLORS` (`lib/equipment.ts`) — which colors exist and what each weighs is physical and not editable, only which ones you actually have is. `ownedLoopBands` is the same idea for the separate closed-loop-band catalog (`LOOP_BAND_STRENGTHS`/`LOOP_BAND_HEX`) — kept apart from `ownedBands` since a loop band and a tube band are different physical equipment even where a color name repeats (see `Load` above). All were hardcoded before the Equipment screen existed (`OWNED_FREE_WEIGHTS` for what's now the dumbbell list, no kettlebell or loop-band concept at all, and tube bands implicitly assumed all-owned); migrating an older snapshot without a field — or with the pre-split single `ownedFreeWeights` list from an earlier version of this screen — defaults or reshapes to those same values, so nobody's computed warmup results changed the moment any of these shipped.

The working free-weight stepper's *values* aren't capped to a small hardcoded list — it walks a fixed 0 (bodyweight) → 3 → 5 → +2.5 sequence (`buildWeightSequence()` in `components/EditModeSheet.tsx`) covering any realistic dumbbell — but whether it walks *that* sequence or just your owned weights is `limitWeightToOwned`'s call: true (the default) swaps it for `[0, ...ownedDumbbells ∪ ownedKettlebells ∪ (each ×2)]` instead, falling back to the fixed sequence if nothing's owned yet rather than leaving the stepper stuck at bodyweight. The doubled values matter: a dumbbell entry is an owned *pair*, and holding both together (or one in each hand) reaches twice the per-dumbbell weight — owning a pair of 15s means 30 is a real, reachable load, not just 15. `LoadEditor`'s "Restrict to home equipment" checkbox (inline wherever a free weight is edited) reads and writes this same global flag rather than being its own per-exercise setting — see PRD §5/§9. This applies only to the *working*-target editor in Edit Mode and New Exercise — Equipment's own "add a new weight" stepper always uses the fixed sequence (minus bodyweight, since you can't own a 0 lb dumbbell) regardless of this flag, since limiting it to owned weights while using it to add a new one would be circular. The working band picker in Edit Mode still shows all five tube-band colors regardless of ownership either way — bands were never part of this restriction, only free weight.

Gym workouts skip this restriction entirely, regardless of the flag's value — see `workouts[].type` above.

The dumbbell/kettlebell split **only matters for how Equipment Settings tracks and labels them** — for picking a warmup weight, either is just a number you can grab, so `computeWarmupLoad` (`lib/format.ts`) merges both lists before calling `pickWarmupWeight`. `pickWarmupWeight`/`pickWarmupBand` (`lib/equipment.ts`) both take `owned` as a required parameter, no default — deleting the old hardcoded fallback was deliberate, so a caller can't silently compute against stale equipment by forgetting to pass it. An empty merged list (every weight removed) resolves to `0`, which `computeWarmupLoad` folds into `{ kind: "bodyweight" }` rather than displaying a nonsensical "0 lbs" — the same zero-means-bodyweight convention Edit Mode's merged bodyweight/free-weight stepper already uses.

## `profile`

Personal, non-equipment preferences — currently just the Home Screen greeting name:

```
{ name: string }
```

Edited on Settings' General tab (PRD §11). Kept as its own top-level field rather than folded into `equipment`, since a name isn't physical gear. Predates being editable — `loadData()` defaults a missing `profile` to `{ name: "Ben" }`, matching what was previously hardcoded in the Home Workouts greeting.

## Persistence: localStorage backed by cloud sync

Every field above is stored under one `localStorage` key (`pt-tracker-data`) — that part is unchanged. What's new: `storage.ts`'s `migrate()` (the transform this whole document's field-by-field migration notes describe) is now shared by two callers, not one — `loadData()` runs it against the local snapshot, and `adoptCloudData()` runs the identical transform against a snapshot fetched from a small Supabase-backed sync endpoint, since a cloud snapshot can be exactly as old-shaped as a local one. A second, separate `localStorage` key (`pt-tracker-updated-at`) tracks a plain timestamp, bumped on every write, used to decide whether the local or cloud copy is more current on each load. See PRD's [Cloud sync](PRD.md#cloud-sync) for the full mechanism — this is why the field-level migration notes throughout this document now matter for two data sources, not just one.

## What this app is, on purpose

- A **reminder**: what exercises, in what order, what weight/band, what form cues — not a workout logger you have to check in with every time.
- A **progression tracker**: when you bump the weight or reps on something, that becomes a dated entry so you can see the trend over time.
- **Not** a PT/rehab tracker — that's a separate app for now.
