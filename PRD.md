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
  - Name (renaming happens via Edit Workout — §9 — not inline on this list)
  - Last completed date (derived from completion log; "never" if none yet)
- FAB (+) → Create New Home Workout (see [§9](#9-create-new-home-workout)).
- An **"Equipment"** pill in the header → Equipment Settings (§11) — owned free weights and bands, which feed the computed warmup suggestion everywhere else in the app.
- Tap a workout → Workout Overview.

### 3. Workout Overview

This is the primary "what do I do today" screen — the goal is that on a normal day, you never need to leave it.

- Exercises listed in order, **visually grouped by superset** (exact visual treatment — bracket, border, label — TBD, not resolved here).
- **Under each exercise, a compact warmup panel and working panel, side by side.** This is a change from the earlier draft, which deliberately kept weight/reps off this screen; moving them here is what makes the overview self-sufficient for most days. It's the same `target`/warmup data Movement Detail already reads — just summarized inline, not duplicated in storage.
- **Typography: a small label, a big glanceable number.** Each panel's header carries the set count (`Warmup (x1)`, `Working (x2)`) — pulled out of the value line, not prefixed onto it. Below that, one bold, larger-type row per side: `15 lbs x 15`, or two rows for an asymmetric exercise (`L: 10 lbs x 10` / `R: 80 lbs x 15`). This exists because the previous single-sentence format ("(x2) L: 10 reps @ 10 lbs (Yellow band); R: ...") was real-use-tested mid-workout and came back as "too many numbers... I want to glance at this, not squint and parse it."
- **Bands render as small horizontal color bars on their own line below each weight/reps row**, not inline after them — a version with bars inline wrapped unpredictably once a wide combo didn't fit the narrow Workout Overview panel, landing at a different, oddly-indented point depending on that row's own text length. On its own line, a single flat horizontal row of bars fits even the narrowest panel width regardless of band count — up to 5, every color at once, is the most an exercise could ever have — so the column-stacking an earlier version used to avoid overflow isn't needed at all. For an asymmetric exercise, the gap between Left's text+bars unit and Right's is deliberately bigger than the gap between a row's own text and its bars, so it's unambiguous which weight a given row of bars belongs to. (Two earlier variants of the color treatment were tried and dropped before this one: side-by-side dots between the weight and reps, and a colored keyline around the whole panel — mocked up in Figma and rejected as not reading as cleanly.) Every bar carries a subtle light outline (`box-shadow`, not `border` — a border would eat into the bar's own 2-3px height under this app's border-box sizing) so the darkest band color (black, rendered as a dark grey stand-in) doesn't disappear against the page background. Same treatment on Movement Detail (§4) — one shared formatter and rendering component, not two versions to keep in sync.
- **Warmup weight is computed for every exercise, not left as math.** The warmup row always shows an actual weight or band to grab — 50-75% of the working target, picked from your real home equipment — instead of asking you to do the percentage math yourself. Bodyweight exercises warm up as bodyweight; asymmetric exercises compute and show both sides independently. See [Home equipment](#home-equipment) below and [Edit Mode](#5-edit-mode-repsweight) for how (and when) this computation can be overridden.
- **An exercise with no warmup at all still shows the section — it just says "None required."** (e.g. Same Side Dead-Bugs.) An earlier version hid the whole Warmup panel for these, which read as broken/inconsistent once every other exercise in the workout showed Warmup and Working side by side. The panel isn't a tap target in this state — there's no weight to edit when none applies. Separately, an exercise whose warmup and working are numerically identical (Single Leg Standing 8-Point Leg Reaches — both are `Bodyweight x 1`, since the real difference is reach *distance*, not weight or reps) still shows both rows for consistency, with the actual distinction carried as a form cue rather than invented as a new data field for one exercise.
- **Alternate exercises share one slot, not separate rows.** A superset slot with more than one exercise (e.g. Lying Tricep Extensions / Single Arm Band Kick-Backs) renders as a single horizontally swipeable card, with the next alternate peeking in at the edge — not stacked as extra list items. This keeps "how many exercises in this superset" visually honest (it's the slot count, not the exercise count), and makes the alternate relationship implicit in the layout rather than needing an "or" label to explain it.
- **Two distinct tap targets per exercise**, differentiated by type/affordance/spacing rather than separate rows:
  - Tapping the **exercise name** → **Movement Detail** (§4), for cues, notes, history, or Edit Details.
  - **Both the warmup and working panels open Edit Mode** (§5) — same sheet either way, since Edit Mode now edits both. (Went through two intermediate designs here: first the whole panel as one tap target with both lines stacked inside — ambiguous about what you were about to change. Then, briefly, warmup made plainly non-interactive since Edit Mode only touched working at the time. Real use surfaced that as its own problem — "I don't love that you can't edit the warmup, that it's all computed whether you want it or not" — which is what led to Edit Mode handling both, described below, rather than warmup staying locked to the computed value forever.)
  - Overview stays read-only/glanceable until one of these is deliberately tapped.
- **Log Workout**, directly on this screen — resolves the earlier open item on placement. Sits inline right below the header, not floating/fixed (an earlier version pinned it to the bottom of the viewport). A `Log Workout` button arms on first tap, its label changing to a confirm state (`Record Workout on Aug 8`, using today's date) that must be tapped again to actually record it — guards against an accidental single tap. See [§8](#8-log-workout-completion) for what the write does.
- **No dynamic stretching reference shown here** — an earlier version displayed it inline below the title, but it was dropped in favor of keeping this screen focused on the exercises themselves. The underlying field isn't gone: it's still set per workout via Create/Edit Home Workout (§9), just not surfaced on Overview.

### 4. Movement Detail

Reached by tapping an exercise on the Workout Overview, when you want more than the summary line shows.

- Exercise name.
- Media: picture/gif/video, collapsible.
- **Warmup** and **Working Sets** sections — same bold, glanceable typography and structure as Workout Overview's panels (§3): a header with the set count, one bold row per side (asymmetric exercises show Left and Right, each with its own tempo note below if one exists). Both sections **open Edit Mode** (§5) when tapped, same as the panels on Workout Overview.
- Set counts (warmup/working) are pulled from the **workout-level protocol** (e.g. 2 working + 1 warmup), not set per-exercise — matches the existing data model, no override mechanism in MVP.
- Actions row: **View History**, full width. (An earlier version had a separate "Edit reps/weight" button here too — once the Working section itself became tappable, that was a second entry point to the exact same action, so it was removed rather than kept as a redundant shortcut.)
- **Edit Details** as a secondary link below the row (see [§10](#10-edit-exercise-details) — metadata only, separate from editing reps/weight).
- **Back to Overview** via the back-link at the top of the screen.
- **Next/previous movement:** a left/right swipe (not a button — an earlier draft had a "Next Movement →" button here; removed since a swipe reads more naturally as "step through the workout" and freed up the button slot for View History) advances through the current superset's slots, then into the next superset, in workout order, and back again. A small `‹ ›` pill cluster, right-justified on the same line as the exercise name, doubles as both the discoverability cue for the swipe *and* a tappable shortcut — whichever direction has nowhere to go renders disabled/dimmed rather than disappearing, so the cluster's shape stays consistent across the whole workout. (An earlier version used barely-visible arrows pinned to the screen edges, purely as a visual hint with no tap target — too subtle to actually read as "you can do something here.") `Notes` isn't built yet (§6) so isn't in this row.

### 5. Edit Mode (reps/weight)

Reached by tapping either the warmup or working panel on Workout Overview (§3), or either section on Movement Detail (§4) — same sheet regardless of which one you tap, since it edits both.

**Working**, unchanged from earlier:

- **Free weight:** stepper, ±2.5 / 5 / 7.5 / 10 lbs.
- **Band:** band-color (or combo) picker instead of a numeric stepper.
- **Loop band:** a multi-select picker among the three strengths (light/moderate/strong) — same toggle-combo interaction as the tube-band picker, since multiple loop bands are often worn at once.
- **Bodyweight / no load:** no weight control at all — reps-only edit.
- Reps: a stepper, same ±1-at-a-time interaction as weight. (An earlier pass added a toggle for a working-set range like 12-15 — reverted; it added real complexity, keeping min ≤ max valid in the UI, for a use case that didn't earn it. Reps is a single number.)
- **Left/Right split:** off by default (single combined input). Toggling it splits weight + reps into two parallel inputs labeled Left / Right.
- Saving updates the exercise's current target **and** appends a dated entry to its progression history — this is the only thing that writes to progression; there's no separate "log a set" action. Warmup changes never touch progression.

**Warmup**, shown above Working when the exercise has one (`warmupReps` set — see [Edit Exercise Details](#10-edit-exercise-details)):

- A **"Match Working (50-75%)" checkbox, checked by default.** Checked, warmup is a read-only preview computed live from whatever Working is currently set to in this same sheet — adjust Working's weight or band and the warmup preview updates immediately. This is the accelerator: for the common case (warmup should just track working), there's nothing to separately configure.
- **Unchecking it** replaces the preview with a real editor — the same weight/band controls as Working, just independent of it. An asymmetric exercise gets independent Left/Right editors, matching Working's split. First opened, it seeds from whatever the computed value currently is, so unchecking starts you from a sensible number rather than blank.
- **This choice persists per exercise**, not just for the current edit — checking or unchecking is a real, remembered setting (`warmupLoad`), not a one-time in-the-moment toggle. An unlinked exercise stays unlinked (showing its independently-set load) until the box is checked again.
- This replaced an earlier, simpler design where warmup was always computed with no way to override it at all, editable only as a plain-text escape hatch from Edit Exercise Details. Real use surfaced that as too rigid — sometimes the 50-75% rule genuinely shouldn't apply, and the fix belonged in the same weight/band editor as Working, not a separate typed sentence.

### 6. Notes

- A "+ Add Note" trigger inside the Notes section (not a separate sheet — light enough to live inline) reveals a small textarea. Voice-to-text isn't custom-built; it's inherited for free from the OS keyboard's dictation feature on any standard text input.
- Each saved note renders as its own card (subtle lighter background, rounded corners, tight padding) — deliberately differentiated from the plain-text sections above it (Warmup, Working Sets, Cues, Progression). An earlier version rendered notes as plain rows with just a bottom-border separator; once more than one or two notes stacked up, that read as undifferentiated noise rather than distinct entries.
- A small icon cluster per note — a pencil (edit) and a pin — replaces an earlier text-button design ("Pin"/"Pinned") that felt heavy-handed for something this minor. Pin toggles inline, one tap, no confirmation. Pinned state shows as a filled/accent pin vs. an outline muted one, the same "dim vs. bright" visual language already used for band swatches elsewhere in this app.
- Pinning/unpinning animates: the note's card gets a brief accent-colored flash (pin only, not unpin — it's the more surprising of the two actions), and any note whose position changes as a result slides there rather than jumping instantly, so reordering reads as a move instead of a cut. Unpinning drops a note back to its ordinary chronological spot among the unpinned notes, animated the same way. Both respect `prefers-reduced-motion`.
- Tapping the pencil opens that note's own edit view in place: the same textarea pattern as adding a note, prefilled with its current text, with **Delete Note** (red outline) and **Save Changes** (blue, primary CTA style) side by side, plus a small `×` to back out without saving or deleting (a real gap in the first pass — there was no way to cancel an edit once opened). Deleting asks for confirmation first (reusing the same in-sheet confirm pattern as Edit Exercise Details), since it's permanent and sits right next to Save Changes.
- Editing a note's text does **not** change its timestamp or sort position — you're fixing what you wrote, not creating a new observation.
- Saved notes appear directly on the Movement Detail page: date-stamped, most-recent-first, pinned notes always on top regardless of date.
- Notes are guidance/observations (trainer cues, how a session felt) — not structured data, just free text.
- While a note is being added or edited, the page's primary CTAs (Edit reps/weight, View History, Edit Details) dim and become inert. Only one thing should be editable at a time, and three primary-looking buttons competing with an open note editor felt like too many options at once. They return to normal the moment the note editor closes, whether by save, cancel, or delete.

### 7. History

- Reached via a "View History" link on Movement Detail.
- **Connected scatter:** each past progression entry plotted as a point (weight on X, reps on Y), connected in chronological order so the trajectory is visible, not just a cloud of dots.
- Only entries with **both** a weight and a rep value get plotted — some progression entries (older trainer notes, a note-only entry) have just one or neither. Those are counted and disclosed ("N earlier entries ... not shown") rather than silently making the chart look sparser than the real history, or silently making one up.
- Asymmetric exercises (left/right progression entries) get two separate connected series, color-coded, with a small legend — not one line blending two different loads together.
- Fewer than 2 plottable points: no chart (a single point or a line to nowhere isn't a "trend") — a plain-text message showing that one data point instead, or "no history yet" for zero.
- Nav back to Movement Detail and to Workout Overview.

### 8. Log Workout (completion)

- A single, low-friction action marking "I did this workout today" — a timestamp, nothing more.
- Lives on Workout Overview (§3), behind a two-step confirm (tap to arm, tap again to record) to guard against an accidental log.
- Distinct from progression history: this tracks *that* a workout happened, not what happened inside it.
- Powers: "last completed" on the Workout List, and the 7-day count on the Welcome screen.

### 9. Create New Home Workout

Triggered by the FAB (+) on the Home Workout List, at `/workouts/new`. A single scrolling page rather than a multi-step wizard — sections stacked top to bottom in the same order as the underlying structure (a workout is a name + protocol + an ordered list of supersets, each holding an ordered list of slots, each slot a primary exercise plus optional alternates). This matches how the rest of the app favors one glanceable page over paginated flows, and this screen is used rarely enough that wizard back/next state wasn't worth building.

1. **Name the workout**, typed directly into the page's title (an input styled and sized like the `screen-title` heading everywhere else, with a dashed underline as the only hint it's editable) rather than a heading plus a separate labeled field below it — one place to look, not two saying the same thing. Required to save.
2. **Build supersets, in order.** "+ Add Superset," then within each one "+ Add Exercise" per slot, and per slot, "+ Add Alternate" for a swipeable substitute (e.g. Lying Tricep Extensions / Single Arm Band Kick-Backs) — same picker either way, just scoped to the slot instead of the superset. An alternate renders as an indented "↳" row directly under its primary, with its own × remove control; removing the primary removes the whole slot, alternates included. Reordering and removing use one consistent control cluster at both the superset and slot level: the ↑/↓ pill (same one used for Movement Detail's prev/next navigation) plus a small circular × next to it — not drag-and-drop, consistent with everything else here being hand-rolled without a gesture/drag library, and creating a workout is infrequent enough that drag's ergonomics aren't worth the complexity. (An earlier pass had the superset-level remove as a plain text button separate from the ↑/↓ cluster — it read as a second, misaligned control instead of part of the same group, so it became the same × used at the slot level.) An empty superset (no exercises added) is silently dropped on save rather than erroring. Adding an exercise already used anywhere in the superset — as another slot's primary, or as an existing alternate — is blocked: the picker (below) shows it grayed out with "Already in this superset" rather than hiding it outright, so it's clear why it can't be tapped.
3. **Add exercise (per slot or alternate):** opens a sheet with a search box over the exercise library, or **"+ New Exercise"** at the bottom to define one that doesn't exist yet — same sheet, its content swapped, rather than stacking a second sheet (mirrors how Notes toggles between its add/edit views). Search matches **name or tag**, case-insensitive substring — see `tags` in `DATA_MODEL.md`. Since tags are freeform, typing "ar" deliberately matches both an "arm"-tagged and an "arms"-tagged exercise rather than requiring one spelling.
4. **New Exercise (minimal):**
   - Name
   - Load type — **free weight** (target weight in lbs), **band** (color/combo), or **bodyweight/no load** (no weight field)
   - Target reps — a plain number, reusing Edit Mode's Stepper (no range toggle; ranges were tried and dropped app-wide, see §5)
   - Same/Left-Right toggle for the target, reusing the same interaction and components as Edit Mode (§5)
   - Tags — freeform add/remove chips, same pattern as Edit Exercise Details
   - Everything else — warmup text, progression rule, links, media — starts empty and gets filled in later via **Edit Exercise Details** (§10). The exercise is saved into the shared library immediately, so it's reusable (and searchable) in future workouts right away, even before that detail is added.
5. **Protocol.** Prefilled with the standard protocol seen in existing workouts (2 working sets, 1 warmup set, rest 15-30s within superset / 60-90s between supersets); editable via the same Stepper controls used elsewhere. No min ≤ max enforcement on the rest ranges, deliberately — same reasoning as dropping rep-range validation in §5.
6. **Dynamic stretching reference.** Optional free-text field, defaults empty.
7. **Save** → back to Home Workout List; the new workout shows "last completed: never." Disabled until the workout has a name and at least one non-empty superset.

**Editing and deleting an existing workout** reuse this same builder rather than a separate flow — one place this structure ever gets built or changed. An **"Edit"** pill next to the workout name on Workout Overview opens it at `/workouts/:workoutId/edit`, prefilled with the workout's current name, supersets/slots, protocol, and stretching note. Saving there updates the existing workout in place (button reads **Save Changes**) and returns to Workout Overview instead of the Workout List, since you were already looking at that workout. A **Delete Workout** button appears only in edit mode, below Save — tapping it swaps to an inline "Delete this workout? This can't be undone." confirmation (Cancel/Delete, the same in-place pattern used for note deletion) rather than deleting on the first tap, since this is permanent. Deleting also removes any logged completions for that workout — an orphaned completion pointing at a workout that no longer exists isn't a history worth keeping.

### 10. Edit Exercise Details

A metadata-only editor for an exercise, reached via an "Edit Details" link on Movement Detail (§4) — implemented as a bottom sheet, same pattern as Edit Mode.

- Header reads **"Edit [Exercise Name] Details"** rather than just the exercise name — Edit Mode's sheet already uses the bare name as its header, so this disambiguates which editor is open at a glance.
- Editable: **warmup** (a "This exercise has a warmup" checkbox, which reveals a Warmup Reps stepper when checked — the one thing about warmup that doesn't derive from the working target and isn't set from Edit Mode; the weight/band itself is set there instead, see §5), progression rule (single-line — this text is never more than about one line in practice, so a resizable textarea would be over-building it), cues (add/remove, via a text input + Add button), tags (same add/remove pattern as cues — see `tags` in `DATA_MODEL.md`), links (instructional/video URLs — "media" here means these two link fields; there's no picture/gif upload, matching `DATA_MODEL.md`'s note that the source note had no extractable images).
- **Unsaved-changes guard:** closing (X or backdrop tap) with any pending edit — including text typed into the "add a cue" field but never added — shows a custom in-sheet "Discard unsaved changes?" prompt (Cancel/Discard) instead of silently losing it. Styled to match the sheet rather than a native browser `confirm()`, consistent with the rest of this app being fully custom. Saving always bypasses this, since saving isn't a discard.
- **Does not** touch target weight/reps and never writes to the progression log — that stays exclusive to Edit Mode (§5). Keeping these two edit paths separate avoids accidentally generating a progression entry just because someone added a form cue. Verified: editing details leaves `progression[]` and `target` byte-for-byte unchanged.

### 11. Equipment Settings

A dedicated screen (not a sheet — there's no single exercise/workout it's scoped to, so it's reached from the global Home Workout List rather than launched over one), covered in full in [Home equipment](#home-equipment) above. Editing here writes immediately (no explicit Save button) — the same instant-persist pattern as toggling a note's pin, since there's no multi-field form to accidentally half-fill and lose.
## Logging philosophy

Two separate, intentionally lightweight logs — no per-set/per-session logging:

1. **Progression log** (per exercise) — one entry per *target change*, written automatically when you edit reps/weight.
2. **Completion log** (per workout) — one entry per *"I did this workout,"* written by one explicit tap.

Neither requires data entry beyond what you'd naturally do (adjust a weight, tap "done").

## Data model implications

Flagging what this brief requires in `seed-data.json` / `DATA_MODEL.md`:

- **Resolved:** **workout completions** — `{ workoutId, date }`, a new top-level `completions[]` array. See `DATA_MODEL.md`.
- **Resolved:** **notes** — `{ id, exerciseId, text, createdAt, pinned }`, a new top-level `notes[]` array. `createdAt` is a full timestamp rather than a date, unlike `progression[]`/`completions[]` — see `DATA_MODEL.md`.
- **Resolved, then reverted:** `target.reps` briefly became `number | RepRange` to support a working-set range like 12-15, distinct from the exercise's general `repRange` metadata. Reverted back to a plain `number` — the min ≤ max validity logic it required in Edit Mode wasn't worth it for a use case that hadn't proven necessary. See `DATA_MODEL.md`.
- "Next movement" navigation is computable from `workouts[].supersets[].slots[]` ordering — implemented, no schema change was needed.
- Edit-mode branching by `Load.kind` (freeWeight / band / bodyweight) matches the existing `Load` union — implemented, no schema change was needed.
- Creating a workout/exercise doesn't need new entities — it's just new entries in the existing `exercises[]` and `workouts[]` arrays. The only rule to enforce: **only Edit Mode (§5) appends to an exercise's `progression[]`** — Edit Exercise Details (§10) and workout creation (§9) both write metadata/structure only.

**Implemented so far:** every screen in this document (§3-10) — all reading/writing through `localStorage`, wired end to end.

## Home equipment

The trainer's "50-75% of working weight" warmup guidance assumes a weight rack; a real home setup is some specific set of dumbbells and resistance bands, which won't always land a perfect match — at a 10 lb working weight with only 3s and 10s on hand, the ideal warmup range (5-7.5 lbs) isn't reachable with either pair, so the app picks the closer/safer option (3 lbs) instead of pretending a perfect match exists. Both free weights and bands are computed this way now (bands compute by total resistance across every combination of owned colors, not just a single lighter color) — see `DATA_MODEL.md`'s "Computed warmup weight" section for the exact rule.

**Equipment**, reached via a link on the Home Workout List, is where owned free weights and bands actually live — no longer hardcoded:

- **Dumbbells and Kettlebells, as two separate sections** — same add/remove list pattern (same as cues/tags elsewhere) for each, but with different copy: Dumbbells notes that an entry is assumed to be an owned *pair* ("a 10 lb pair is just '10'", not the combined 20 lb total), while Kettlebells makes clear each entry is counted individually, no pair assumption. Neither restricts what you can dial in for a *working* target, which stays free-form on purpose — a working weight can be anything, and shouldn't be capped by what's on file. The two lists are only kept apart for how this screen tracks and labels them; a warmup suggestion doesn't care which one a weight came from, so they're combined into one pool wherever that's computed.
- **Tube Bands**: the five colors (yellow=10, green=20, blue=30, black=40, red=50 lbs — a fixed, physical property of the bands themselves, not editable) shown as toggleable swatches, marking which you actually own. This also doesn't restrict the working-target band picker in Edit Mode, which still shows and allows all five regardless of ownership — equipment ownership is scoped to warmup suggestions only, an explicit and deliberate MVP simplification, not an oversight.
- **Loop Bands**: a second, separate set of toggleable swatches for the three closed-loop band strengths (light/moderate/strong, e.g. Lateral Band Walks) — a physically different kind of band from Tube Bands above, kept as its own section (and its own `ownedLoopBands` list) even though "blue" and "black" happen to name a color in both catalogs. Same ownership-only scoping as Tube Bands: doesn't restrict the working-target picker, only feeds the computed warmup suggestion.
- **The inline accelerator**: dialing in a working free weight that isn't already owned (checked against both lists) surfaces a small "+ Add {N} lbs to your equipment" prompt right there in Edit Mode — the moment you'd actually know about a new weight is when you're setting it as a target, not a separate trip to a settings screen later. It defaults to adding as a dumbbell (this app's exercises are overwhelmingly dumbbell-based); reclassify as a kettlebell on the Equipment screen itself if that's what it actually was. No equivalent prompt for either band catalog, since band ownership is a yes/no toggle on a fixed catalog, not an open-ended value like weight.

## Open items

- Which exercise is "featured" first in the welcome-screen sparkline carousel.
- Visual treatment for superset grouping on Workout Overview (bracket/border/label).
- Whether "Edit Exercise Details" is prompted immediately after inline-creating a new exercise, or purely accessed later from Movement Detail.
- PT Workouts, Gym Workouts — future scope, unmodeled.
- Visual design (this doc is behavior/structure, not UI mockups).

## Future ideas (explicitly post-MVP)

- **Apple Health / Watch integration — heart rate only.** Not being designed now. Noting one likely dependency for whenever we pick this up: heart rate would need to be correlated against a workout's *start and end time*, but MVP's completion log is a single timestamp ("I did this today"), not a duration — pulling heart rate meaningfully probably requires richer session tracking than what §8 currently scopes.

- **AI-generated workout.** Not being designed now. Would take exercise history/progression, available equipment (`OWNED_FREE_WEIGHTS`/`BAND_WEIGHTS`), and desired session duration into account, asking a few guiding questions first (focus area, time available, anything sore/off today) before proposing a session. The real fork isn't the reasoning — the existing data model already carries most of the needed inputs — it's that this would be the app's *first* feature requiring a network call and API key; everything today is offline/localStorage only, so this is an architectural decision, not just a new screen. **MVP shape:** a short guided form (2-3 questions) feeding a single AI call that proposes a one-off session built from the existing exercise library — not necessarily saved as a reusable workout template the way Create Home Workout's output is. A smaller, fully-offline first step worth considering before wiring up real AI: a rules-based "suggest what's due" heuristic (e.g. surface exercises that haven't progressed in a while), no network dependency at all.

- **Camera-based form analysis.** Not being designed now. Feasible at a modest scope, not at a general one — full form coaching across arbitrary exercises is a large, dedicated computer-vision undertaking (what commercial fitness-tech products invest real engineering teams in), not a natural incremental step from here. **MVP shape:** pick one or two exercises with simple, geometric form checks (e.g. knee tracking on a lunge, left/right symmetry on the shoulder-rehab asymmetric exercises — see `asymmetryNote` in `DATA_MODEL.md`), using client-side pose estimation (e.g. MediaPipe or TensorFlow.js, running entirely in-browser off the phone camera, no video leaving the device) to flag deviations against a few hand-picked thresholds rather than open-ended AI judgment. A cloud vision-LLM route (sending frames to Claude) is more flexible but reintroduces the same network/API dependency as the AI-workout idea above, adds latency that works against real-time correction, and sends video off-device.
