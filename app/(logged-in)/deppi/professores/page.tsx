import ProfessoresScreen from "@/src/screens/Professores";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function ProfessoresPage() {
  return (
    <ProtectedRoute roles={["DEPPI"]}>
      <ProfessoresScreen />
    </ProtectedRoute>
  );
}
