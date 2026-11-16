import ProtectedRoute from "@/src/components/ProtectedRoute";
import EnrollmentSummary from "@/src/screens/EnrollmentSummary";

export default async function ResumoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProtectedRoute roles={["ALUNO"]}>
      <EnrollmentSummary inscricaoId={id} />
    </ProtectedRoute>
  );
}
