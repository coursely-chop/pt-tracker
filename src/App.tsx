import { Route, Routes } from "react-router-dom";
import EditModeSheet from "./components/EditModeSheet";
import { DataProvider } from "./lib/DataContext";
import History from "./screens/History";
import HomeWorkoutList from "./screens/HomeWorkoutList";
import MovementDetail from "./screens/MovementDetail";
import WorkoutOverview from "./screens/WorkoutOverview";

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<HomeWorkoutList />} />
        <Route path="/workouts/:workoutId" element={<WorkoutOverview />} />
        <Route path="/workouts/:workoutId/exercises/:exerciseId" element={<MovementDetail />} />
        <Route path="/workouts/:workoutId/exercises/:exerciseId/history" element={<History />} />
      </Routes>
      <EditModeSheet />
    </DataProvider>
  );
}
