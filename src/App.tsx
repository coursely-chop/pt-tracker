import { Route, Routes } from "react-router-dom";
import EditDetailsSheet from "./components/EditDetailsSheet";
import EditModeSheet from "./components/EditModeSheet";
import { DataProvider } from "./lib/DataContext";
import EquipmentSettings from "./screens/EquipmentSettings";
import History from "./screens/History";
import HomeWorkoutList from "./screens/HomeWorkoutList";
import MovementDetail from "./screens/MovementDetail";
import WorkoutBuilder from "./screens/WorkoutBuilder";
import WorkoutOverview from "./screens/WorkoutOverview";

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<HomeWorkoutList />} />
        <Route path="/equipment" element={<EquipmentSettings />} />
        <Route path="/workouts/new" element={<WorkoutBuilder />} />
        <Route path="/workouts/:workoutId/edit" element={<WorkoutBuilder />} />
        <Route path="/workouts/:workoutId" element={<WorkoutOverview />} />
        <Route path="/workouts/:workoutId/exercises/:exerciseId" element={<MovementDetail />} />
        <Route path="/workouts/:workoutId/exercises/:exerciseId/history" element={<History />} />
      </Routes>
      <EditModeSheet />
      <EditDetailsSheet />
    </DataProvider>
  );
}
