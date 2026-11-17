import { Suspense } from "react";
import CourseDetail from "@/src/screens/CourseDetail";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export const instant = false;

export default function CursoDetailPage() {
  return (
    <ProtectedRoute roles={["ALUNO"]}>
      <Suspense fallback={<p className="center-msg" role="status">Carregando detalhes do curso…</p>}>
        <CourseDetail />
      </Suspense>
    </ProtectedRoute>
  );
}
