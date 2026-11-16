import ProtectedRoute from "@/src/components/ProtectedRoute";
import EnrollmentDocuments from "@/src/screens/EnrollmentDocuments";

export default async function DocumentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProtectedRoute roles={["ALUNO"]}>
      <EnrollmentDocuments inscricaoId={id} />
    </ProtectedRoute>
  );
}
