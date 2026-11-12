import ProtectedRoute from "@/src/components/ProtectedRoute";
import CoursesCatalog from "@/src/screens/CoursesCatalog";

export const instant = false;

export default function AlunoPage() {
  return (
    <ProtectedRoute roles={["ALUNO"]}>
      <CoursesCatalog />
    </ProtectedRoute>
  );
}
