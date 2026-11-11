import CursosScreen from "@/src/screens/Cursos";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function ProfessorCursosPage() {
  return (
    <ProtectedRoute roles={["PROFESSOR"]}>
      <CursosScreen mode="professor" />
    </ProtectedRoute>
  );
}
