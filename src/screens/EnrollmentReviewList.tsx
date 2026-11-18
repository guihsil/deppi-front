"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import {
  asApiError, canRetry, courseEnrollmentPath, date, decisionSuccess, statusLabels, type Enrollment,
} from "../lib/enrollment-review";

type CourseEnrollments = { courseName: string; enrollments: Enrollment[] };

export default function EnrollmentReviewList({ courseId, view, decision }: {
  courseId: string;
  view: "pending" | "reviewed";
  decision?: string | string[];
}) {
  const { token } = useAuth();
  const [result, setResult] = useState<CourseEnrollments | ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = view === "pending";
  const title = pending ? "Inscrições para análise" : "Alunos inscritos";
  const success = pending ? decisionSuccess(decision) : undefined;
  const course = result && !(result instanceof Error) ? result : null;

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const options = { token, signal: controller.signal, cache: "no-store" } as const;

    async function loadCourseEnrollments() {
      try {
        const [{ data }, { inscricoes }] = await Promise.all([
          api<{ data: { nome: string } }>(`/cursos/${encodeURIComponent(courseId)}`, options),
          api<{ inscricoes: Enrollment[] }>(pending ? "/inscricoes?status=PENDENTE" : "/inscricoes", options),
        ]);
        if (controller.signal.aborted) return;

        const enrollments = inscricoes.filter(({ curso, status }) => curso.id === courseId && (
          pending ? status === "PENDENTE" : status === "DEFERIDO" || status === "INDEFERIDO" || status === "CANCELADO"
        ));
        setResult({ courseName: data.nome, enrollments });
      } catch (error) {
        if (!controller.signal.aborted) setResult(asApiError(error));
      }
    }

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setResult(null);
      void loadCourseEnrollments();
    });
    return () => controller.abort();
  }, [courseId, pending, token, attempt, decision]);

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="enrollment-review-heading">
          <h1>{title}</h1>
          {course && <p className="muted">{course.courseName}</p>}
        </div>
        <div className="profile-header-actions">
          <Link className="btn btn-ghost" href="/deppi/cursos">Voltar para cursos</Link>
          {course && (
            <Link className="btn btn-ghost" href={courseEnrollmentPath(courseId, pending ? "reviewed" : "pending")}>
              {pending ? "Alunos inscritos" : "Voltar para inscrições"}
            </Link>
          )}
        </div>
      </header>

      {course && success && <p className="profile-feedback" role="status">{success}</p>}
      {result === null && (
        <p className="muted" role="status">{pending ? "Carregando inscrições…" : "Carregando alunos inscritos…"}</p>
      )}
      {result instanceof Error && (
        <div className="card profile-card">
          <p className="profile-feedback error" role="alert">
            {result.status === 403 ? "Você não tem permissão para consultar as inscrições deste curso." :
              result.status === 404 ? "Curso não encontrado." : result.message}
          </p>
          {canRetry(result) && (
            <div className="profile-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAttempt((current) => current + 1)}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      )}

      {course && (course.enrollments.length > 0 ? (
        <ul className="profile-page">
          {course.enrollments.map(({ id, aluno, data, status }) => (
            <li key={id} className="card enrollment-review-student-card">
              <div className="enrollment-review-student-data">
                <h2 className="profile-section-title">{aluno.usuario.nome}</h2>
                <dl className="enrollment-review-student-fields">
                  <div>
                    <dt className="profile-field-label">Matrícula</dt>
                    <dd>{aluno.matricula}</dd>
                  </div>
                  {pending && (
                    <div>
                      <dt className="profile-field-label">Data da inscrição</dt>
                      <dd><time dateTime={data}>{date.format(new Date(data))}</time></dd>
                    </div>
                  )}
                  <div>
                    <dt className="profile-field-label">Status</dt>
                    <dd>{statusLabels[status]}</dd>
                  </div>
                </dl>
              </div>
              {pending && (
                <Link className="btn" href={`${courseEnrollmentPath(courseId)}/${encodeURIComponent(id)}`}
                  aria-label={`Analisar inscrição de ${aluno.usuario.nome}`}>
                  Analisar
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="card">
          <p className="muted">{pending ? "Nenhuma inscrição pendente neste curso" : "Nenhuma inscrição analisada neste curso"}</p>
        </div>
      ))}
    </div>
  );
}
