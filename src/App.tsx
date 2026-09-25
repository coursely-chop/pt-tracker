import { Route, Routes, useParams } from "react-router-dom";
import EditDetailsSheet from "./components/EditDetailsSheet";
import EditModeSheet from "./components/EditModeSheet";
import { DataProvider } from "./lib/DataContext";
import History from "./screens/History";
import HomeWorkoutList from "./screens/HomeWorkoutList";
import MovementDetail from "./screens/MovementDetail";
import Settings from "./screens/Settings";
import WorkoutBuilder from "./screens/WorkoutBuilder";
import WorkoutOverview from "./screens/WorkoutOverview";

/** `/workouts/:workoutId/edit` is one Route match regardless of which
 * workoutId it resolves to, so navigating from one workout's edit page
 * straight to another's (Clone Workout does exactly this) wouldn't remount
 * WorkoutBuilder on its own — its state is seeded by useState lazy
 * initializers that only run once, so it'd keep showing the *previous*
 * workout's name/supersets/protocol under the new URL. Keying by workoutId
 * forces a real remount instead of needing every one of those initializers
 * rewritten as an effect keyed on it, the way EditModeSheet's single
 * long-lived instance already has to. */
function WorkoutEditRoute() {
  const { workoutId } = useParams<{ workoutId: string }>();
  return <WorkoutBuilder key={workoutId} />;
}

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<HomeWorkoutList />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/workouts/new" element={<WorkoutBuilder />} />
        <Route path="/workouts/:workoutId/edit" element={<WorkoutEditRoute />} />
        <Route path="/workouts/:workoutId" element={<WorkoutOverview />} />
        <Route path="/workouts/:workoutId/exercises/:exerciseId" element={<MovementDetail />} />
        <Route path="/workouts/:workoutId/exercises/:exerciseId/history" element={<History />} />
      </Routes>
      <EditModeSheet />
      <EditDetailsSheet />
    </DataProvider>
  );
}
