import ProtectedRoute from "@/src/components/ProtectedRoute";
import ProfessorAccount from "@/src/screens/ProfessorAccount";

export default function ProfessorContaPage() {
  return (
    <ProtectedRoute roles={["PROFESSOR"]}>
      <ProfessorAccount />
    </ProtectedRoute>
  );
}
