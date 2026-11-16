"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { updateEnrollmentDraft } from "../lib/enrollment-drafts";

export default function EnrollmentDocuments({ inscricaoId }: { inscricaoId: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setFeedback({ message: "Sua sessão não está disponível. Entre novamente.", isError: true });
      return;
    }
    if (files.length === 0) {
      setFeedback({ message: "Selecione pelo menos um documento para enviar.", isError: true });
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("documentos", file));
    setSaving(true);
    setFeedback(null);
    try {
      await api<unknown>(`/inscricoes/${encodeURIComponent(inscricaoId)}/documentos`, {
        method: "POST",
        token,
        body: formData,
      });
      try {
        updateEnrollmentDraft(token, inscricaoId, "RESUMO");
      } catch {
        setFeedback({
          message: "Documentos enviados. O progresso não pôde ser salvo localmente.",
          isError: false,
        });
      }
      router.push(`/aluno/inscricoes/${encodeURIComponent(inscricaoId)}/resumo`);
    } catch (error) {
      setFeedback({ message: getErrorMessage(error), isError: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <h1>Envio de documentos</h1>
          <p className="muted">Anexe os documentos solicitados para concluir sua inscrição.</p>
        </div>
        <Link className="btn btn-ghost" href={`/aluno/inscricoes/${encodeURIComponent(inscricaoId)}/renda`}>
          Voltar para renda
        </Link>
      </header>

      {feedback && (
        <p
          className={`profile-feedback${feedback.isError ? " error" : ""}`}
          role={feedback.isError ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}

      <form className="card profile-card" onSubmit={submit}>
        <label>
          Documentos
          <input
            type="file"
            multiple
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []));
              setFeedback(null);
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="enrollment-file-list" aria-label="Arquivos selecionados">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>{file.name}</li>
            ))}
          </ul>
        )}
        <div className="profile-actions">
          <button className="btn" type="submit" disabled={saving || files.length === 0}>
            {saving ? "Enviando…" : "Enviar documentos"}
          </button>
        </div>
      </form>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Não foi possível enviar os documentos.";
  }
  if (error.status === 400) {
    return error.message === "Algo deu errado."
      ? "Não foi possível enviar os documentos. Confira os arquivos selecionados e tente novamente."
      : `Não foi possível enviar os documentos: ${error.message}`;
  }
  if (error.status === 404) {
    return error.message === "Algo deu errado."
      ? "Inscrição não encontrada. Volte ao catálogo e retome o fluxo de inscrição."
      : error.message;
  }
  return error.message;
}
