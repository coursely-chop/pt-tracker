# PT Tracker — Design Brief / PRD

**Status:** Draft v1 — iterating with Ben. Sections marked TBD are intentionally deferred, not forgotten.

## Vision

Replace the Apple Note my trainer shares with a local-first app that (a) reminds me what to do — exercises, order, target weight/reps, form cues — without having to log every rep, and (b) makes visible that I'm actually getting stronger over time.

## MVP Scope

- **In scope:** Home Workout tracking only.
- **Out of scope (future):** PT Workouts, Gym Workouts. The home screen has one primary CTA ("Home Workout") on purpose — room for PT/Gym gets added later without redesigning this flow.
- **Deliberately not built:** a per-session, per-set workout logger. See [Logging philosophy](#logging-philosophy).

## Screens & Flows

### 1. Home / Welcome

- "Welcome back, Ben" header.
- **This week stat:** count of workouts completed in the last 7 days (from workout completion logs — see [§8](#8-log-workout-completion)). A plain number/short string, not a chart — answers "am I showing up."
- **Featured exercise sparkline:** a weight-over-time trend line for one exercise, swipeable to cycle through other exercises. Which exercise is "featured" first (most recently updated? most recently done? user-pinned?) — **open question, revisit with mockups.**
- Primary CTA: **Home Workout** → Home Workout List.

### 2. Home Workout List

- List of saved home workouts. Each row shows:
  - Name (tap to rename inline)
  - Last completed date (derived from completion log; "never" if none yet)
- FAB (+) → Create New Home Workout (see [§9](#9-create-new-home-workout)).
- Tap a workout → Workout Overview.

### 3. Workout Overview

This is the primary "what do I do today" screen — the goal is that on a normal day, you never need to leave it.

- Dynamic stretching reference, shown at the top.
- Exercises listed in order, **visually grouped by superset** (exact visual treatment — bracket, border, label — TBD, not resolved here).
- **Under each exercise, a compact warmup line and working-set line** — sets, reps, and weight/band (per-side values shown side by side if the exercise is asymmetric). This is a change from the earlier draft, which deliberately kept weight/reps off this screen; moving them here is what makes the overview self-sufficient for most days. It's the same `target`/`warmup` data Movement Detail already reads — just summarized inline, not duplicated in storage.
- **Warmup weight is computed, not left as math.** For exercises where it applies, the warmup line shows an actual weight to grab (e.g. "3 lbs") instead of "50-75% of working weight" — picked from your real home equipment. See [Home equipment](#home-equipment) below.
- **Alternate exercises share one slot, not separate rows.** A superset slot with more than one exercise (e.g. Lying Tricep Extensions / Single Arm Band Kick-Backs) renders as a single horizontally swipeable card, with the next alternate peeking in at the edge — not stacked as extra list items. This keeps "how many exercises in this superset" visually honest (it's the slot count, not the exercise count), and makes the alternate relationship implicit in the layout rather than needing an "or" label to explain it.
- **Two distinct tap targets per exercise**, differentiated by type/affordance/spacing rather than separate rows:
  - Tapping the **exercise name** → **Movement Detail** (§4), for cues, notes, history, or Edit Details.
  - Tapping the **warmup/working panel** (the whole block below the name, set apart with a subtle background to signal it's interactive) → opens **Edit Mode** (§5) directly, as an overlay/sheet scoped to that exercise — no detour through Movement Detail required. Same edit surface either way; this is just a second entry point into it, so there's no duplicate editing logic to maintain. (Went through two earlier iterations here: first the working-set line alone as the tap target — too ambiguous next to the warmup line above it — then a standalone edit icon — too much visual prominence for a secondary action. The whole panel, styled as one affordance, reads as "tap here to adjust" without a separate icon competing for attention.)
  - Overview stays read-only/glanceable until one of these is deliberately tapped.
- **Log Workout**, directly on this screen — resolves the earlier open item on placement. A `Log Workout` button arms on first tap, its label changing to a confirm state (`Record Workout on Aug 8`, using today's date) that must be tapped again to actually record it — guards against an accidental single tap. See [§8](#8-log-workout-completion) for what the write does.

### 4. Movement Detail

Reached by tapping an exercise on the Workout Overview, when you want more than the summary line shows.

- Exercise name.
- Media: picture/gif/video, collapsible.
- **Warmup** section: sets + reps, and target load (if the exercise has one — see §5 for load-type branching).
- **Working Sets** section: sets + reps (fixed number, or a range like 12-15 if specified), and target load.
- Set counts (warmup/working) are pulled from the **workout-level protocol** (e.g. 2 working + 1 warmup), not set per-exercise — matches the existing data model, no override mechanism in MVP.
- If the exercise has asymmetric left/right targets, show both side by side; otherwise a single combined value.
- Actions: **Back to Overview** · **Next Movement** (advances through the current superset's slots, then into the next superset, in workout order) · **Edit reps/weight** · **Notes** · **Edit details** (see [§10](#10-edit-exercise-details) — metadata only, separate from editing reps/weight).
- Link into **History**.

### 5. Edit Mode (reps/weight)

Reached two ways — tapping the warmup/working panel directly on Workout Overview (§3), or the "Edit reps/weight" link on Movement Detail (§4). Same surface either way, just two doors into it.

Editing branches by the exercise's load type:

- **Free weight:** stepper, ±2.5 / 5 / 7.5 / 10 lbs.
- **Band:** band-color (or combo) picker instead of a numeric stepper.
- **Bodyweight / no load:** no weight control at all — reps-only edit.
- Reps: numeric input; optional toggle to switch working-set reps to a range (e.g. 12-15) instead of a fixed number.
- **Left/Right split:** off by default (single combined input). Toggling it splits weight + reps into two parallel inputs labeled Left / Right.
- Saving updates the exercise's current target **and** appends a dated entry to its progression history — this is the only thing that writes to progression; there's no separate "log a set" action.

### 6. Notes

- "Notes" action on Movement Detail opens a small text field (supports voice-to-text where the platform provides it).
- Saved notes appear directly on the Movement Detail page: date-stamped, most-recent-first.
- A note can be **pinned**, which keeps it at the top regardless of date.
- Notes are guidance/observations (trainer cues, how a session felt) — not structured data, just free text.

### 7. History

- Reached from Movement Detail.
- **Connected scatter:** each past progression entry plotted as a point (weight on X, reps on Y), connected in chronological order so the trajectory is visible, not just a cloud of dots.
- Nav back to Movement Detail and to Workout Overview.

### 8. Log Workout (completion)

- A single, low-friction action marking "I did this workout today" — a timestamp, nothing more.
- Lives on Workout Overview (§3), behind a two-step confirm (tap to arm, tap again to record) to guard against an accidental log.
- Distinct from progression history: this tracks *that* a workout happened, not what happened inside it.
- Powers: "last completed" on the Workout List, and the 7-day count on the Welcome screen.

### 9. Create New Home Workout

Triggered by the FAB on the Home Workout List. A guided, sequential flow that mirrors the underlying structure (a workout is a name + protocol + an ordered list of supersets, each holding one exercise per slot):

1. **Name the workout.** Required; can be renamed later from the Workout List.
2. **Build supersets, in order.** "Add superset," then within it "Add exercise" per slot. No alternates in this flow (a slot is exactly one exercise) — matches the decision to keep MVP creation simple; the existing alternate exercises (Tricep Extension / Kick-Back) stay as-is, defined directly in the data.
3. **Add exercise (per slot):** search/pick from the existing exercise library by name, or **"+ New Exercise"** to define one that doesn't exist yet.
4. **New Exercise (minimal):**
   - Name
   - Load type — **free weight** (target weight in lbs), **band** (color/combo), or **bodyweight/no load** (no weight field)
   - Target reps (fixed number, or toggle to a range)
   - Same/Left-Right toggle for the target, reusing the same interaction as Edit Mode (§5)
   - Everything else — warmup text, progression rule, cues, links, media — starts empty and gets filled in later via **Edit Exercise Details** (§10). The exercise is saved into the shared library immediately, so it's reusable in future workouts right away, even before that detail is added.
5. **Protocol.** Prefilled with the standard protocol seen in existing workouts (2 working sets, 1 warmup set, rest 15-30s within superset / 60-90s between supersets); editable if this workout ever needs different timing.
6. **Dynamic stretching reference.** Optional free-text field, defaults empty.
7. **Save** → back to Home Workout List; the new workout shows "last completed: never."

Reordering exercises/supersets during this flow (drag vs. up/down controls) is a visual-design detail, not resolved here.

### 10. Edit Exercise Details

A metadata-only editor for an exercise, reached from Movement Detail (§4) or optionally right after inline-creating a new exercise in §9.

- Editable: warmup text, progression rule, cues (add/remove), links (instructional/video URLs), media.
- **Does not** touch target weight/reps and never writes to the progression log — that stays exclusive to Edit Mode (§5). Keeping these two edit paths separate avoids accidentally generating a progression entry just because someone added a form cue.

## Logging philosophy

Two separate, intentionally lightweight logs — no per-set/per-session logging:

1. **Progression log** (per exercise) — one entry per *target change*, written automatically when you edit reps/weight.
2. **Completion log** (per workout) — one entry per *"I did this workout,"* written by one explicit tap.

Neither requires data entry beyond what you'd naturally do (adjust a weight, tap "done").

## Data model implications

Flagging what this brief requires in `seed-data.json` / `DATA_MODEL.md`:

- New entity, still not implemented: **workout completions** — `{ workoutId, date }`.
- New entity, still not implemented: **notes** — `{ id, exerciseId, text, createdAt, pinned }`.
- **Resolved:** `target.reps` is now `number | RepRange`, so a working-set target can be a fixed count (15) or a live range (12-15), distinct from the exercise's general `repRange` metadata. See `DATA_MODEL.md`.
- "Next movement" navigation is computable from `workouts[].supersets[].slots[]` ordering — implemented, no schema change was needed.
- Edit-mode branching by `Load.kind` (freeWeight / band / bodyweight) matches the existing `Load` union — implemented, no schema change was needed.
- Creating a workout/exercise doesn't need new entities — it's just new entries in the existing `exercises[]` and `workouts[]` arrays. The only rule to enforce: **only Edit Mode (§5) appends to an exercise's `progression[]`** — Edit Exercise Details (§10) and workout creation (§9) both write metadata/structure only.

**Implemented so far:** Home Workout List, Workout Overview, Movement Detail, and Edit Mode (§3-5) — all reading/writing through `localStorage`, wired end to end. Log Workout, Notes, History, Create New Home Workout, and Edit Exercise Details are still just this brief.

## Home equipment

The trainer's "50-75% of working weight" warmup guidance assumes a weight rack; the actual home setup is a **3 lb dumbbell pair, a 10 lb dumbbell pair, and resistance bands**. That gap is real — at a 10 lb working weight, the ideal warmup range (5-7.5 lbs) isn't reachable with either pair, so the app picks the closer/safer option (3 lbs) instead of pretending a perfect match exists. See `DATA_MODEL.md`'s "Computed warmup weight" section for the exact rule.

Scope of this pass: **free weights only**. Band "resistance" doesn't reduce the same way a free weight does (it means switching to a different band, not a fractional one), so Resistance Band Curls and Single Arm Band Kick-Backs still show the trainer's plain-text warmup guidance. Extending this to bands needs an actual band inventory (which colors are owned) — not captured yet.

The equipment list itself is a hardcoded constant (`OWNED_FREE_WEIGHTS` in `src/lib/equipment.ts`) — there's no settings screen to edit it yet. Worth revisiting if/when equipment changes (e.g. a 5 lb pair gets added) or if this extends to bands.

## Open items

- Which exercise is "featured" first in the welcome-screen sparkline carousel.
- Visual treatment for superset grouping on Workout Overview (bracket/border/label).
- Reordering mechanics in the create-workout flow (drag vs. up/down controls).
- Whether "Edit Exercise Details" is prompted immediately after inline-creating a new exercise, or purely accessed later from Movement Detail.
- Restructuring an already-saved workout (reorder/add/remove exercises) — explicitly deferred; for now, structural changes mean creating a new workout.
- PT Workouts, Gym Workouts — future scope, unmodeled.
- Visual design (this doc is behavior/structure, not UI mockups).

## Future ideas (explicitly post-MVP)

- **Apple Health / Watch integration — heart rate only.** Not being designed now. Noting one likely dependency for whenever we pick this up: heart rate would need to be correlated against a workout's *start and end time*, but MVP's completion log is a single timestamp ("I did this today"), not a duration — pulling heart rate meaningfully probably requires richer session tracking than what §8 currently scopes.
