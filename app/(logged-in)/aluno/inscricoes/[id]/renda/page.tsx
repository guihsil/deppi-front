import ProtectedRoute from "@/src/components/ProtectedRoute";
import IncomeForm from "@/src/screens/IncomeForm";

export default async function RendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProtectedRoute roles={["ALUNO"]}>
      <IncomeForm inscricaoId={id} />
    </ProtectedRoute>
  );
}
