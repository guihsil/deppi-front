import ProtectedRoute from "../../../src/components/ProtectedRoute";
import Placeholder from "../../../src/screens/Placeholder";

export default function AlunoPage() {
  return (
    <ProtectedRoute roles={["ALUNO"]}>
      <Placeholder />
    </ProtectedRoute>
  );
}
