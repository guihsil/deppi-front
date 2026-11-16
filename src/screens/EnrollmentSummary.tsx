"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  getEnrollmentDraft,
  type EnrollmentDraft,
} from "../lib/enrollment-drafts";

export default function EnrollmentSummary({ inscricaoId }: { inscricaoId: string }) {
  const { token } = useAuth();
  const [draft, setDraft] = useState<EnrollmentDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!token) {
        setError("Sua sessão não está disponível. Entre novamente.");
        setLoading(false);
        return;
      }
      try {
        const saved = getEnrollmentDraft(token, inscricaoId);
        if (!saved || saved.etapa !== "RESUMO") {
          setError("Não foi possível recuperar o resumo desta inscrição.");
        } else {
          setDraft(saved);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível recuperar o resumo desta inscrição.",
        );
      } finally {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [token, inscricaoId]);

  if (loading) {
    return <p className="center-msg" role="status">Carregando resumo da inscrição…</p>;
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <h1>Resumo da inscrição</h1>
          <p className="muted">Confira a confirmação do envio da sua inscrição.</p>
        </div>
        <Link className="btn btn-ghost" href="/aluno">Voltar para cursos</Link>
      </header>

      {error ? (
        <section className="card course-detail-alert" role="alert">
          <p>{error}</p>
          <Link className="btn" href="/aluno">Ir para cursos</Link>
        </section>
      ) : draft ? (
        <section className="card enrollment-summary" aria-labelledby="enrollment-summary-title">
          <span className="course-badge available">Status: PENDENTE</span>
          <h2 id="enrollment-summary-title">{draft.cursoNome ?? "Inscrição enviada"}</h2>
          <dl className="course-detail-meta">
            <div>
              <dt>Identificador da inscrição</dt>
              <dd>{draft.id}</dd>
            </div>
            <div>
              <dt>Documentos</dt>
              <dd>Enviados</dd>
            </div>
          </dl>
          <p className="muted">
            Sua inscrição foi enviada e aguarda análise. Você pode acompanhar o andamento na área do aluno.
          </p>
          <Link className="btn" href="/aluno">Concluir</Link>
        </section>
      ) : null}
    </div>
  );
}
