import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ExerciseIcon from "../components/ExerciseIcon";
import Sparkline from "../components/Sparkline";
import { resolveExerciseIcon } from "../lib/exerciseIcons";
import { homePath, initialHomeTab, rememberHomeTab } from "../lib/homeTab";
import { formatDelta, getProgress } from "../lib/progress";
import { useData } from "../lib/DataContext";
import type { Workout } from "../types";

/** "Sep 22" — the year only when it isn't this year, to keep lines short. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", thisYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** Every exercise's weight trend at once, for Home or Gym — the overview to
 * History's one-exercise-at-a-time chart. Tapping a row opens that
 * exercise's full History. */
export default function Progress() {
  const { exercises, workouts } = useData();
  const [searchParams] = useSearchParams();
  const [venue, setVenue] = useState<Workout["type"]>(() => initialHomeTab(searchParams.get("tab")));

  const rows = getProgress(exercises, venue);

  function select(next: Workout["type"]) {
    setVenue(next);
    rememberHomeTab(next);
  }

  // History is reached through a workout (its venue picks which timeline to
  // show), so link via any workout of this kind that contains the exercise.
  function historyPath(exerciseId: string): string | null {
    const workout = workouts.find(
      (w) => w.type === venue && w.supersets.some((s) => s.slots.some((sl) => sl.exerciseIds.includes(exerciseId)))
    );
    return workout ? `/workouts/${workout.id}/exercises/${exerciseId}/history` : null;
  }

  return (
    <div className="screen">
      <Link to={homePath(venue)} className="back-link">
        ← Workouts
      </Link>
      <h1 className="screen-title">Progress</h1>

      <div className="kind-picker progress-tabs">
        <button
          type="button"
          className={`kind-picker-btn${venue === "home" ? " selected" : ""}`}
          onClick={() => select("home")}
        >
          Home
        </button>
        <button
          type="button"
          className={`kind-picker-btn${venue === "gym" ? " selected" : ""}`}
          onClick={() => select("gym")}
        >
          Gym
        </button>
      </div>

      {rows.length === 0 && (
        <p className="empty-state">
          Nothing to chart yet for {venue === "gym" ? "Gym" : "Home"} workouts — this fills in as you change weights.
        </p>
      )}

      {rows.map((row) => {
        const path = historyPath(row.exercise.id);
        const changed = row.series.some((s) => s.points.length > 1);
        const body = (
          <>
            <ExerciseIcon icon={resolveExerciseIcon(row.exercise, venue)} size={22} className="progress-row-icon" />
            <div className="progress-row-text">
              <div className="progress-row-name">{row.exercise.name}</div>
              {row.series.map((s) => (
                <div key={s.side ?? "combined"} className="progress-row-latest">
                  {s.side && (
                    <span className={`progress-side progress-side-${s.side}`}>{s.side === "left" ? "L" : "R"}</span>
                  )}
                  {s.last.weight} lbs × {s.last.reps}
                  {s.points.length > 1 && <span className="progress-row-change"> · {formatDelta(s.delta)}</span>}
                </div>
              ))}
              <div className="progress-row-delta">
                {changed ? `since ${shortDate(row.firstDate)}` : `Only one entry so far (${shortDate(row.lastDate)})`}
              </div>
            </div>
            <Sparkline series={row.series} />
          </>
        );
        return path ? (
          <Link key={row.exercise.id} to={path} className="progress-row">
            {body}
          </Link>
        ) : (
          <div key={row.exercise.id} className="progress-row">
            {body}
          </div>
        );
      })}
    </div>
  );
}
