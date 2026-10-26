import ProtectedRoute from "../../../src/components/ProtectedRoute";
import Placeholder from "../../../src/screens/Placeholder";

export default function ProfessorPage() {
  return (
    <ProtectedRoute roles={["PROFESSOR"]}>
      <Placeholder />
    </ProtectedRoute>
  );
}
