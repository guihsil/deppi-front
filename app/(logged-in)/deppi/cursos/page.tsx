import CursosScreen from "@/src/screens/Cursos";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function CursosPage() {
  return (
    <ProtectedRoute roles={["DEPPI", "ADMIN"]}>
      <CursosScreen />
    </ProtectedRoute>
  );
}
