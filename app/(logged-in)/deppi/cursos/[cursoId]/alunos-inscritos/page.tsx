import { Suspense } from "react";
import EnrollmentReviewList from "@/src/screens/EnrollmentReviewList";

export default function ReviewedCourseEnrollmentsPage({ params }: {
  params: Promise<{ cursoId: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Carregando alunos inscritos…</p>}>
      {params.then(({ cursoId }) => (
        <EnrollmentReviewList key={cursoId} courseId={cursoId} view="reviewed" />
      ))}
    </Suspense>
  );
}
