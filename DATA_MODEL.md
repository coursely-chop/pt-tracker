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
warmup          string | null — free-text warm-up prescription (fallback, see warmupSpec below)
warmupSpec      { reps, percentRange } | undefined — see "Computed warmup weight" below
progressionRule string | null — the trainer's rule for when/how much to increase
links           { instructional?, video? } — only populated when the source note had a URL
progression     [] — see below
```

### Computed warmup weight

The trainer's note prescribes warmups as "50-75% of working weight," which is fine as a rule but useless as an instruction when you're standing there mid-workout — it requires doing math, then finding a weight that doesn't actually exist in a 3lb/10lb set. `warmupSpec` (`{ reps, percentRange: {min, max} }`) exists so the app can compute an actual number instead: given the exercise's current `target.load` (a freeWeight) and [`OWNED_FREE_WEIGHTS`](src/lib/equipment.ts) (currently hardcoded — no settings screen yet — as `[3, 10]`, reflecting the two dumbbell pairs actually owned), `pickWarmupWeight()` picks whichever owned weight best satisfies the range: the heaviest one that actually falls inside it, or if none do (a real gap in a sparse set), the closest one, tie-breaking toward lighter as the safer direction to be off in.

This only applies where `target.load.kind === "freeWeight"` — band and bodyweight exercises keep the plain `warmup` free-text string, since "50-75% resistance" doesn't reduce the same way for a band (it means a different band, not a fractional one) and hasn't been tackled yet. Only two exercises have `warmupSpec` today: Side Lunges and Lying DB Tricep Extensions. Single Leg Deadlift deliberately doesn't — the trainer's own note already says its warmup is just bodyweight regardless of working weight, so there's nothing to compute.

Because this is computed from `target.load` live, it automatically stays correct as you progress — no separate warmup-weight field to keep in sync.

### `target`

```
target: {
  repRange: { min, max }       // the exercise's general prescribed range, e.g. 8-15 (metadata, not what gets edited)
  perSide: boolean             // true if reps/load are tracked per side
  reps: (number | RepRange) | null   // the LIVE working-set target — a fixed number (15) or a range (12-15)
  load: Load | null            // current target load, when symmetric
  sides: {                     // used INSTEAD of reps/load when the two
    left:  { load, reps },     // sides are asymmetric (see below)
    right: { load, reps }
  } | null
}
```

`repRange` and `reps` used to be easy to conflate — both are "a range of numbers" — so to be explicit: `repRange` is fixed exercise metadata (the trainer's stated range, doesn't change from editing), while `reps` is the thing Edit Mode actually writes to, and can itself be a range if you want to work toward "12-15" rather than a fixed count. Per-side (`sides.left/right.reps`) stays a plain number for now — no exercise has needed an asymmetric range yet, and adding it before it's needed would be speculative.

### `Load`

Weight isn't always a plain number — the note mixes free weights and resistance bands (sometimes stacked, e.g. "red + blue"), so `Load` is a small tagged union:

```
{ kind: "freeWeight", lbs: number }
{ kind: "band", bands: string[], equivalentLbs?: number, homeEquivalentLbs?: number }
{ kind: "bodyweight" }
```

`homeEquivalentLbs` exists only on the kickback exercise, where the note gives a different equivalent weight for the home band set ("70 lbs at home") vs. the gym one.

### Asymmetric sides: Resistance Band Curls & Single Arm Band Kick-Backs

These are the two exercises where left/right get genuinely different weight and reps rather than a symmetric number. That's not incidental — it's your trainer's shoulder-rehab plan: keep training the uninjured (right) arm normally, keep the left slow, light, and controlled. So instead of just storing a smaller number for the left side with no context, each of these exercises carries:

- `target.sides.left.tempo` — a cue that surfaces specifically on the rehab side (e.g. "slow and controlled - shoulder rehab side")
- `asymmetryNote` on the exercise itself, explaining *why* the two sides differ

The goal is that when the app reminds you of this exercise, it doesn't just show "left: 10 lbs" next to "right: 70 lbs" and leave you to remember why — the reasoning travels with the data.

For the other asymmetric-*capable* exercises (Side Lunges, Single Leg Deadlift), the two sides currently use the same weight/reps, so they use the flat `reps`/`load` fields instead of `sides`.

### `progression[]`

This is **not** a per-session workout log — you don't need to check in every time you do the workout. It's a lightweight log of the trainer's own dated notes on weight changes (e.g. Side Lunges: "6/25- used 6lbs", "7/24- used 10lbs", and the current value dated "7/28"). You'd add an entry here only when the target weight/reps actually changes, which is exactly what "track how the reps/weight goes up over time" needs — a timeline of target changes, not a diary of every workout instance.

```
{ date: "YYYY-MM-DD", load: Load | null, reps: (number | RepRange) | null, note: string | null, side?: "left" | "right" }
```

**Assumption flagged:** the source note only gave month/day ("6/25", "7/24", "7/28"), no year. Since today's date is 2026-08-05 and those three dates fall in a plausible recent progression right before today, I inferred year **2026**. If the note is actually older than that, these dates need correcting.

### Alternates

Superset 2's second exercise offers two options ("Lying Tricep Extensions **or** Single Arm Band Kick-Backs"). Both exist as separate exercise definitions, and the alternate carries `alternateFor: "lying-db-tricep-extension"` — keeps both as first-class exercises with their own targets/progression if you end up alternating between them.

### Omitted: pictures

The note contains embedded image placeholders (￼) with no filename, alt text, or URL — nothing extractable. `links` only includes `instructional`/`video` where an actual URL existed.

## `workouts[]`

A workout is the superset structure plus the shared protocol (sets, rest periods) — deliberately *not* per-exercise, since "2 working sets, 1 warm-up, rest 15-30s within superset, 60-90s between supersets" applies to the whole workout, not to any one exercise:

```
{
  id, name,
  structure: {
    dynamicStretching: string,   // pointer to the separate shared note, not duplicated
    protocol: { workingSets, warmupSets, restBetweenExercisesSec: {min,max}, restBetweenSupersetsSec: {min,max}, notes }
  },
  supersets: [
    { order, slots: [ { order, exerciseIds: [...] } ] }   // >1 id in exerciseIds = alternates
  ]
}
```

`slots[].exerciseIds` is an array (not a single id) specifically to support the tricep-extension/kick-back alternate without special-casing it.

## `completions[]`

The "Log Workout" action's entire write — one entry per tap, nothing more:

```
{ workoutId: string, date: "YYYY-MM-DD" }
```

Deliberately separate from `exercises[].progression[]`: this tracks *that* a workout happened, not what happened inside it. "Last completed" on the Workout List is just the max date across a workout's entries — no separate "last completed" field to keep in sync, it's derived (`lib/completions.ts`).

Since this field didn't exist when earlier `localStorage` snapshots were written, `loadData()` defaults it to `[]` for anyone with pre-existing data rather than assuming it's always present — the only field so far that's needed this kind of migration handling.

## What this app is, on purpose

- A **reminder**: what exercises, in what order, what weight/band, what form cues — not a workout logger you have to check in with every time.
- A **progression tracker**: when you bump the weight or reps on something, that becomes a dated entry so you can see the trend over time.
- **Not** a PT/rehab tracker — that's a separate app for now.
