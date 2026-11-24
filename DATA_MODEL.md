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

**One exception to "exactly one place weight/reps lives":** the working target and warmup override are each split into a Home value and a Gym value (see `targets`/`warmupLoads` below) — not because two workouts of the *same* type should ever disagree, but because a gym's weight has nothing to do with what's owned at home, and letting one silently overwrite the other was a real bug (confirmed: dialing in 40 lbs for a Gym chest press silently showed 40 lbs on the Home version of the same exercise too, a weight not even owned at home). Two Home workouts sharing an exercise still share its Home target, same as before — the split is by venue, not by individual workout.

## `exercises[]`

```
id              stable slug, used as the foreign key from workouts[] and progression[]
name
targets         { home, gym } — current prescribed load/reps, split by venue (see below)
icon            string | undefined — key into the curated icon set (`lib/exerciseIconData.ts`); absent means "automatic" (see below)
cues            string[] of form notes — stored, but no longer shown or editable (see below)
tags            string[] — freeform (e.g. "legs", "core"), powers the exercise picker's search
warmup          string | null — free-text warm-up prescription (fallback, see warmupSpec below)
warmupSpec      { reps, percentRange } | undefined — see "Computed warmup weight" below
progressionRule string | null — the trainer's rule for when/how much to increase
links           { instructional?, video? } — only populated when the source note had a URL
progression     [] — see below
```

### `icon`

A string key (e.g. `"sports_martial_arts"`) into `EXERCISE_ICONS` in `lib/exerciseIconData.ts` — 30 Material Icons (Apache 2.0) stored as inline SVG path data rather than pulled in as a package. **Absent means automatic:** `resolveExerciseIcon()` falls back to a default for the exercise's resistance type (`exerciseKind()` — free weight, machine, band, loop band, bodyweight), so every exercise has an icon with no data entered, and an unknown or removed key falls back the same way. Only the key is stored, so adding or swapping icons (e.g. your own drawings) is editing that one file, not migrating data. Like `name`, it's shared across Home and Gym — it identifies the exercise, not a weight.

### Hidden details: `cues`, `progressionRule`, `links`, `tags`, `asymmetryNote`

These were edited on a separate Edit Details screen (PRD §10), which has been removed — in practice only the name was ever used (7 of 26 exercises had any of them, all from the original trainer note). They are **kept on every exercise** and round-trip through saves untouched, but no screen shows or edits them any more; new exercises start with them empty. Exercise search still matches an exercise's existing `tags`, but tags can no longer be added to a new one.

### `tags`

Deliberately freeform rather than a fixed taxonomy (`["legs", "arms", "core", ...]`) — you're the only one ever tagging an exercise, so there's no real risk of tags fragmenting into unmanageable synonyms, and a fixed list would mean maintaining an enum for a 7-exercise library. Search (in the Create New Home Workout exercise picker) does a plain case-insensitive substring match against name *and* tags, so "ar" matches both an "arm"-tagged and an "arms"-tagged exercise without needing them reconciled into one spelling. Editable after creation via Edit Exercise Details, same add/remove pattern as `cues`.

### Computed warmup weight

The trainer's note prescribes warmups as "50-75% of working weight," which is fine as a rule but useless as an instruction when you're standing there mid-workout — it requires doing math, then finding a weight that doesn't actually exist in a 3lb/10lb set. So this is computed for every exercise, not read as a vague percentage:

```
warmupReps: number | null;                                        // rep count; null means no warmup at all — shared across Home and Gym
warmupLoads: {                                                    // split by venue, same reason and same shape as targets below
  home: Load | { left: Load; right: Load } | null;                // null = linked (computed); set = independent
  gym:  Load | { left: Load; right: Load } | null;
}
```

`warmupLoads[venue]` is null by default — "linked" — meaning warmup is always computed live as 50-75% of whatever `targets[venue].load` (or, for asymmetric exercises, `targets[venue].sides.left/right.load`) currently is, where `venue` is whichever workout is being rendered (`workout.type`). `getWarmupLines()` finds the closest thing to actually grab from owned equipment:

- **Free weight:** at home, `pickWarmupWeight()` picks whichever owned dumbbell or kettlebell (the Equipment screen — see `## equipment` below) best satisfies the range — the heaviest one that actually falls inside it, or if none do (a real gap in a sparse set), the closest one, tie-breaking toward lighter as the safer direction to be off in. In a gym it runs the same search over a plain ladder (3, then every 5 lbs) instead — see the Gym workouts bullet below.
- **Band:** a tube band is just a resistance in lbs, so its warmup is `lbs * 0.625` rounded to the nearest 10 — tube bands come in tens. No owned-equipment search (there are no owned colors to search anymore), gym or home.
- **Loop band:** `pickWarmupLoopBand()` searches every combination of owned loop bands (see `Load` above), summing ordinal ranks since loop bands have no real lbs — a working `["moderate"]` resolves to `["light"]` when all three are owned, one level lighter.
- **Machine:** not owned equipment, so there's no list to search — always `lbs * 0.625` rounded to the nearest multiple of that load's own `increment`, gym or home alike.
- **Bodyweight** (or no load) has nothing to scale — it warms up as bodyweight too, which falls out of the math rather than needing a special case.
- **Asymmetric exercises** (`targets[venue].sides`) compute each side independently and show both, the same way the working line does — a single number would misrepresent two genuinely different targets.
- **Gym workouts** (`workouts[].type === "gym"`) skip the owned-equipment search for free weight and loop-band entirely — a gym has a full rack, so rounding a gym warmup to whatever dumbbells happen to be owned *at home* was always wrong, the same bug the working-set stepper's restrict-to-home-equipment toggle already doesn't have in gym mode (§5 in `PRD.md`). Free weight runs the usual 50-75% range search (`pickWarmupWeight()`) over `GYM_WARMUP_WEIGHTS` — 3 lbs, then every 5 — rather than rounding to the nearest 2.5: gym dumbbells jump in fives, so a computed 27.5 isn't a weight you can pick up (45 lbs now warms up at 30, not 27.5). Loop bands search all three strengths rather than `equipment.ownedLoopBands`. `computeWarmupLoad()`'s third parameter, `isGym`, is what every caller (`getWarmupLines()`, Edit Mode's "Match Working" preview, New Exercise's warmup preview) threads through from the workout or `GymModeContext` it already has in scope — the same `isGym`/`venue` selects which of `targets`/`warmupLoads`' two buckets to read in the first place.

Setting `warmupLoads[venue]` "unlinks" it: an independent `Load` (or, for an asymmetric exercise, a `{ left, right }` pair) takes over instead, edited in Edit Mode the same way as the working target — see §5 in `PRD.md`. This is the escape hatch for whenever 50-75% shouldn't apply, and it's what makes the rule safe to apply everywhere rather than needing a per-exercise flag for exceptions: an exception is just an unlink. Unlike the working target, an unlinked warmup override never generates a `progression[]` entry — warmup isn't a tracked metric, just a convenience.

An earlier version of this made warmup a free-text override (`warmup: string | null`) instead of a structured `Load` — simpler to store, but it meant warmup could only ever be *read*, not edited through the same weight/band controls as everything else. Real use surfaced that as a real gap ("I don't love that you can't edit the warmup, that it's all computed whether you want it or not"), so it was replaced with a structured value editable the same way as the working target.

**`warmupReps: null` is shown, not hidden.** An exercise with no warmup at all (Same Side Dead-Bugs) still gets a Warmup section — it just reads "None required" instead of a computed line, and isn't a tap target (there's no weight to edit when none applies). An earlier version omitted the section entirely for these exercises, which read as broken rather than intentional once the rest of the workout consistently showed both Warmup and Working side by side.

**Not every real distinction is a `Load`.** Single Leg Standing 8-Point Leg Reaches warms up and works at the identical `Bodyweight x 1` — the actual difference between the two (reach a shorter distance on warmup, further on working) is about distance, which isn't a quantity this app tracks anywhere. Rather than inventing a field for one exercise's nuance, that distinction is carried as a form cue instead — the same free-text mechanism this exercise's `progressionRule` ("Increase distance of the reaching leg") already relies on.

**A real bug this design fixed:** Single Leg Deadlift's original seed data said its warmup was "bodyweight" — accurate when the note was first transcribed (the working weight *was* bodyweight then), but the trainer's actual rule was "50% of working weight," and the working weight has since progressed to 10 lbs without the warmup text ever being updated to match. Computing it live instead of freezing it as text is what prevents this class of staleness going forward.

**Migration backfill:** `loadData()` fills a still-null `warmupReps` from the current seed file's default for a matching exercise id. This exists because `saveExercise()` rewrites every exercise's shape on any single save (not just the one being edited), so there's no reliable way to tell "this record predates `warmupReps`" apart from "warmup was deliberately turned off" once even one unrelated exercise has been saved — both end up as `warmupReps: null`. Given this app has exactly one user and no one has yet had the chance to deliberately disable warmup on a stock exercise, backfilling from seed is the safe read today. If that stops being true, this needs a real "explicitly configured" marker instead of inferring intent from nullness.

Because this is computed from the working load live, it automatically stays correct as you progress — no separate warmup-weight field to keep in sync.

### `targets`

```
targets: {
  home: ExerciseTarget,
  gym:  ExerciseTarget,
}

// ExerciseTarget:
{
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

**Split by venue, not just one shared value.** Every read site (`getWorkingLines()`, `getWarmupLines()`, Edit Mode, Movement Detail) picks `targets.home` or `targets.gym` from whichever workout it's currently rendering for (`workout.type`); nothing ever falls back to "the other one" or merges them. A brand-new exercise seeds both buckets with the same entered value (see `createExercise` in `DataContext.tsx`) — they only diverge once one is actually edited from within a Gym or Home workout. Editing always writes through `updateExerciseTarget(exerciseId, isGym, ...)`, which replaces exactly one bucket.

Before this split, there was exactly one shared `target` — editing the working weight from a Gym workout silently changed what a Home workout using the same exercise showed too, which is how a Gym chest press ended up dialed to a weight (40 lbs on one side) that wasn't even owned at home. Migrating an older snapshot seeds both `home` and `gym` from whatever single `target` it finds (see `storage.ts`'s `migrate()`) — they start out identical and only diverge from the next edit onward, so migrating alone doesn't retroactively fix a value that's wrong for one venue; that still needs a manual edit once, the same as any other data correction.

`repRange` and `reps` are easy to conflate — both are "a range of numbers" — so to be explicit: `repRange` is fixed exercise metadata (the trainer's stated range, doesn't change from editing), while `reps` is the single number Edit Mode actually writes to. An earlier pass let `reps` also be a range (e.g. "work toward 12-15") via a `RepsTarget = number | RepRange` union, with a min/max split in Edit Mode — that's been reverted. It added real complexity (keeping min ≤ max valid in the UI) for a use case that didn't earn it, so `reps` is back to a plain number everywhere: `targets[venue]`, per-side targets, and `progression[]` entries alike.

### `Load`

Weight isn't always a plain number — the note mixes free weights and resistance bands (sometimes stacked, e.g. "red + blue"), so `Load` is a small tagged union:

```
{ kind: "freeWeight", lbs: number }
{ kind: "band", lbs: number }
{ kind: "bodyweight" }
{ kind: "loopBand", strengths: ("light" | "moderate" | "strong")[] }
{ kind: "machine", lbs: number, increment: number }
```

A tube band is recorded by **total resistance in lbs, nothing else** — no colors. It used to be a list of colors (`bands: ["red", "blue"]`, yellow=10, blue=20, green=30, black=40, red=50, summed when stacked, with an optional `overrideLbs` for a band set that didn't match) — which stopped working once higher-resistance bands arrived in the *same* colors, so a color no longer implied a weight. The editor is a stepper in 10 lb steps over a 10-500 lb sequence; an older off-grid value like 65 is kept as-is and just snaps to the nearest step on the first tap. (Earlier drafts stored `equivalentLbs` / `homeEquivalentLbs` as independent numbers — also gone.)

**Migration** (`convertBandLoads()` in `storage.ts`): every band load anywhere in an exercise — working targets, either side, warmup overrides, history entries — is rewritten from the color shape to `{ lbs }` on load: `overrideLbs` if it was set, else the sum of the old color weights, else 10 for an empty selection. It accepts both shapes permanently (not a one-time pass) because an older copy can arrive at any time — a phone still on the previous version pushing to the cloud. `Equipment.ownedBands` is dropped the same way. Verified against a real production snapshot: all 56 band loads converted to the exact expected totals, history/completion/workout counts unchanged.

`machine` is a weight-stack or plate-loaded machine — its own kind rather than reusing `freeWeight`, for two reasons: a machine isn't owned equipment (nothing in Equipment Settings tracks it, and the restrict-to-home-equipment logic — see `equipment` below — has no meaning for it), and it doesn't share free weights' fixed 0/3/5/+2.5 ladder. `increment` is stored per-load (not app-wide) because it genuinely varies machine to machine — a leg press might move in 15s, a cable stack in 2.5s — and is editable right in `LoadEditor` alongside the weight itself, not in Equipment Settings.

`loopBand` is a second, separate kind of band (e.g. Lateral Band Walks) — a closed loop, often worn multiple at once (e.g. light + strong together), so like `band` above it's an array rather than a single value; unlike `band`, though, there's no real lbs weight to sum, just an ordinal ranking (see `computeLoopBandWeight()`). Kept as its own `Load` kind (not folded into `band`) even though the two catalogs' color names happen to overlap ("blue", "black") — a loop band and a tube band are physically different equipment, and `Equipment.ownedLoopBands` is tracked separately from `ownedBands` for the same reason. Its warmup uses `pickWarmupLoopBand()` in `lib/equipment.ts`, which shares its combo-search core with `pickWarmupBand()`, substituting ordinal rank (light=1/moderate=2/strong=3) for real weight.

### Asymmetric sides: Resistance Band Curls & Single Arm Band Kick-Backs

These are the two exercises where left/right get genuinely different weight and reps rather than a symmetric number. That's not incidental — it's your trainer's shoulder-rehab plan: keep training the uninjured (right) arm normally, keep the left slow, light, and controlled. So instead of just storing a smaller number for the left side with no context, each of these exercises carries:

- `targets[venue].sides.left.tempo` — a cue that surfaces specifically on the rehab side (e.g. "slow and controlled - shoulder rehab side")
- `asymmetryNote` on the exercise itself, explaining *why* the two sides differ

The goal is that when the app reminds you of this exercise, it doesn't just show "left: 10 lbs" next to "right: 70 lbs" and leave you to remember why — the reasoning travels with the data.

For the other asymmetric-*capable* exercises (Side Lunges, Single Leg Deadlift), the two sides currently use the same weight/reps, so they use the flat `reps`/`load` fields instead of `sides`.

### `progression[]`

This is **not** a per-session workout log — you don't need to check in every time you do the workout. It's a lightweight log of the trainer's own dated notes on weight changes (e.g. Side Lunges: "6/25- used 6lbs", "7/24- used 10lbs", and the current value dated "7/28"). You'd add an entry here only when the target weight/reps actually changes, which is exactly what "track how the reps/weight goes up over time" needs — a timeline of target changes, not a diary of every workout instance.

```
{ date: "YYYY-MM-DD", load: Load | null, reps: number | null, note: string | null, side?: "left" | "right", venue?: "home" | "gym" }
```

**`venue`** records which kind of workout the change was made from, for the same reason `targets`/`warmupLoads` are split: Home and Gym weights are independent, and one shared timeline put a gym 45 lb chest press next to a home 20 lb one. Absent means Home (the trainer-note and pre-gym entries). **One entry per day, venue, and side:** Edit Mode saves replace an earlier un-noted entry with the same date/venue/side rather than appending (`updateExerciseTarget`), so fixing a typo or nudging a weight twice in a session doesn't leave two rows; entries with a `note` are always kept. Dates use the device's local calendar day, not UTC, so one day's saves group together.

**Assumption flagged:** the source note only gave month/day ("6/25", "7/24", "7/28"), no year. Since today's date is 2026-08-05 and those three dates fall in a plausible recent progression right before today, I inferred year **2026**. If the note is actually older than that, these dates need correcting.

**Not every entry is plottable.** The History screen (`lib/history.ts`) plots weight over time and needs both a numeric weight and a numeric reps value to place a point (free weight, machine, and band loads count) — bodyweight entries have no weight axis, and some entries (the two seed entries above, and the one legacy note-only Band Curls entry) have `reps: null` or both fields `null`. Those are counted (`skippedCount`) and disclosed on the History screen rather than just vanishing, so the chart never looks like a more complete history than it is.

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
{ workoutId: string, date: "YYYY-MM-DD", at?: string /* full ISO timestamp */ }
```

`at` is optional: it's the full ISO timestamp of the tap, added so the Home Screen can say *when* a workout was done today. `date` is a UTC date (`todayISO()`), so it can already be tomorrow for an evening workout — "is this today?" is therefore decided from `at` in the device's local time (`completedTodayAt()` in `lib/completions.ts`), never from `date`. Completions logged before `at` existed simply lack it and never show the done-today state (there's no time to display); nothing needs migrating.

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
{ ownedDumbbells: number[], ownedKettlebells: number[], ownedLoopBands: string[], limitWeightToOwned: boolean }
```

`limitWeightToOwned` also decides how *home* warmups are computed: on, they pick from the owned lists below; off, there is no list to pick from, so they use the same standard-step ladder as a gym warmup (`computeWarmupLoad()`'s `unrestricted = isGym || !limitWeightToOwned`). `ownedDumbbells` and `ownedKettlebells` are both plain, user-editable lists of lbs values — kept separate because they carry a different real-world assumption: a dumbbell entry means an owned *pair* (enter "10" for a 10 lb pair, not the combined 20), while a kettlebell entry means one. `ownedLoopBands` is the same idea for the separate closed-loop-band catalog (`LOOP_BAND_STRENGTHS`/`LOOP_BAND_HEX`). All were hardcoded before the Equipment screen existed (`OWNED_FREE_WEIGHTS` for what's now the dumbbell list, no kettlebell or loop-band concept at all, and tube bands implicitly assumed all-owned — tube bands are no longer tracked as equipment at all); migrating an older snapshot without a field — or with the pre-split single `ownedFreeWeights` list from an earlier version of this screen — defaults or reshapes to those same values, so nobody's computed warmup results changed the moment any of these shipped.

The working free-weight stepper's *values* aren't capped to a small hardcoded list — it walks a fixed 0 (bodyweight) → 3 → 5 → +2.5 sequence (`buildWeightSequence()` in `components/LoadControls.tsx`) covering any realistic dumbbell — but whether it walks *that* sequence or just your owned weights is `limitWeightToOwned`'s call: true (the default) swaps it for `[0, ...ownedDumbbells ∪ ownedKettlebells ∪ (each ×2)]` instead, falling back to the fixed sequence if nothing's owned yet rather than leaving the stepper stuck at bodyweight. The doubled values matter: a dumbbell entry is an owned *pair*, and holding both together (or one in each hand) reaches twice the per-dumbbell weight — owning a pair of 15s means 30 is a real, reachable load, not just 15. `LoadEditor`'s "Restrict to home equipment" checkbox (inline wherever a free weight is edited) reads and writes this same global flag rather than being its own per-exercise setting — see PRD §5/§9. This applies only to the *working*-target editor in Edit Mode and New Exercise — Equipment's own "add a new weight" stepper always uses the fixed sequence (minus bodyweight, since you can't own a 0 lb dumbbell) regardless of this flag, since limiting it to owned weights while using it to add a new one would be circular. The working band picker in Edit Mode still shows all five tube-band colors regardless of ownership either way — bands were never part of this restriction, only free weight.

Gym workouts skip this restriction entirely, regardless of the flag's value — see `workouts[].type` above.

The dumbbell/kettlebell split **only matters for how Equipment Settings tracks and labels them** — for picking a warmup weight, either is just a number you can grab, so `computeWarmupLoad` (`lib/format.ts`) merges both lists before calling `pickWarmupWeight`. `pickWarmupWeight`/`pickWarmupBand` (`lib/equipment.ts`) both take `owned` as a required parameter, no default — deleting the old hardcoded fallback was deliberate, so a caller can't silently compute against stale equipment by forgetting to pass it. An empty merged list (every weight removed) resolves to `0`, which `computeWarmupLoad` folds into `{ kind: "bodyweight" }` rather than displaying a nonsensical "0 lbs" — the same zero-means-bodyweight convention Edit Mode's merged bodyweight/free-weight stepper already uses.

## `profile`

Personal, non-equipment preferences — currently just the Home Screen greeting name:

```
{ name: string }
```

Edited on Settings (PRD §11). Kept as its own top-level field rather than folded into `equipment`, since a name isn't physical gear. Predates being editable — `loadData()` defaults a missing `profile` to `{ name: "Ben" }`, matching what was previously hardcoded in the Home Workouts greeting.

## Persistence: localStorage backed by cloud sync

Every field above is stored under one `localStorage` key (`pt-tracker-data`) — that part is unchanged. What's new: `storage.ts`'s `migrate()` (the transform this whole document's field-by-field migration notes describe) is now shared by two callers, not one — `loadData()` runs it against the local snapshot, and `adoptCloudData()` runs the identical transform against a snapshot fetched from a small Supabase-backed sync endpoint, since a cloud snapshot can be exactly as old-shaped as a local one. A second, separate `localStorage` key (`pt-tracker-updated-at`) tracks a plain timestamp, bumped on every write, used to decide whether the local or cloud copy is more current on each load. See PRD's [Cloud sync](PRD.md#cloud-sync) for the full mechanism — this is why the field-level migration notes throughout this document now matter for two data sources, not just one.

## What this app is, on purpose

- A **reminder**: what exercises, in what order, what weight/band, what form cues — not a workout logger you have to check in with every time.
- A **progression tracker**: when you bump the weight or reps on something, that becomes a dated entry so you can see the trend over time.
- **Not** a PT/rehab tracker — that's a separate app for now.
