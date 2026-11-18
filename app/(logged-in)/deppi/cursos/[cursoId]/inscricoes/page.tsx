import { Suspense } from "react";
import EnrollmentReviewList from "@/src/screens/EnrollmentReviewList";

export default function CourseEnrollmentQueuePage({ params, searchParams }: {
  params: Promise<{ cursoId: string }>;
  searchParams: Promise<{ decisao?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<p role="status">Carregando inscrições…</p>}>
      {Promise.all([params, searchParams]).then(([{ cursoId }, { decisao }]) => (
        <EnrollmentReviewList key={cursoId} courseId={cursoId} view="pending" decision={decisao} />
      ))}
    </Suspense>
  );
}
