import InstituicoesScreen from "@/src/screens/Instituicoes";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function InstituicoesPage() {
  return (
    <ProtectedRoute roles={["DEPPI", "ADMIN"]}>
      <InstituicoesScreen />
    </ProtectedRoute>
  );
}
