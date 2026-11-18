import { Suspense } from "react";
import EnrollmentReview from "@/src/screens/EnrollmentReview";

export default function EnrollmentReviewPage({ params }: {
  params: Promise<{ cursoId: string; inscricaoId: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Carregando inscrição…</p>}>
      {params.then(({ cursoId, inscricaoId }) => (
        <EnrollmentReview key={JSON.stringify([cursoId, inscricaoId])} courseId={cursoId} id={inscricaoId} />
      ))}
    </Suspense>
  );
}
