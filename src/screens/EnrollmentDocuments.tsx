"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { updateEnrollmentDraft } from "../lib/enrollment-drafts";
import { documentUploadBody } from "../lib/document-upload";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ACCEPTED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const CATEGORIES = [
  "RG",
  "CPF",
  "COMPROVANTE_RESIDENCIA",
  "COMPROVANTE_RENDA",
  "HISTORICO_ESCOLAR",
  "OUTRO",
] as const;

type Category = (typeof CATEGORIES)[number];
type FileStatus = "pending" | "sending" | "uploaded" | "failed" | "invalid";
type DocumentFile = {
  key: string;
  file: File;
  category: Category;
  status: FileStatus;
  error?: string;
};

function validateFile(file: File): string | undefined {
  if (file.size > MAX_FILE_SIZE) return "O arquivo excede o limite de 5 MiB.";
  const extension = file.name.split(".").pop()?.toLowerCase();
  const acceptedType =
    ACCEPTED_TYPES.has(file.type) ||
    (!file.type && extension !== undefined && ACCEPTED_EXTENSIONS.has(extension));
  if (!acceptedType) return "Formato não permitido. Selecione PDF, JPEG ou PNG.";
  return undefined;
}

function categoryLabel(category: Category): string {
  switch (category) {
    case "COMPROVANTE_RESIDENCIA":
      return "Comprovante de residência";
    case "COMPROVANTE_RENDA":
      return "Comprovante de renda";
    case "HISTORICO_ESCOLAR":
      return "Histórico escolar";
    default:
      return category;
  }
}

export default function EnrollmentDocuments({ inscricaoId }: { inscricaoId: string }) {
  const { token, usuario } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  function addFiles(selectedFiles: File[]) {
    const newFiles = selectedFiles.map((file, index): DocumentFile => {
      const error = validateFile(file);
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${index}`,
        file,
        category: "OUTRO",
        status: error ? "invalid" : "pending",
        ...(error ? { error } : {}),
      };
    });
    setFiles((current) => [...current, ...newFiles]);
    setFeedback(null);
  }

  function updateFile(key: string, changes: Partial<DocumentFile>) {
    setFiles((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...changes } : entry)),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setFeedback({ message: "Sua sessão não está disponível. Entre novamente.", isError: true });
      return;
    }

    const queue = files.filter((entry) => entry.status === "pending" || entry.status === "failed");
    const hasInvalidFiles = files.some((entry) => entry.status === "invalid");
    if (queue.length === 0 && !hasInvalidFiles && files.some((entry) => entry.status === "uploaded")) {
      completeEnrollment(token);
      return;
    }
    if (queue.length === 0) {
      setFeedback({
        message: hasInvalidFiles
          ? "Remova os arquivos inválidos antes de continuar."
          : "Selecione pelo menos um documento para enviar.",
        isError: true,
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    let usuarioID = usuario?.id;
    try {
      // Sessões salvas antes da inclusão do id precisam consultar o perfil.
      if (!usuarioID) {
        const response = await api<{ id?: string; usuario?: { id?: string } }>("/users/me", { token });
        usuarioID = response?.usuario?.id ?? response?.id;
      }
      if (typeof usuarioID !== "string" || !usuarioID.trim()) {
        throw new Error("Não foi possível identificar o usuário. Entre novamente.");
      }
    } catch (error) {
      setSaving(false);
      setFeedback({ message: getErrorMessage(error), isError: true });
      return;
    }
    const results = new Map<string, Pick<DocumentFile, "status" | "error">>();
    let uploadedCount = 0;
    const failures: string[] = [];

    for (const entry of queue) {
      results.set(entry.key, { status: "sending" });
      updateFile(entry.key, { status: "sending", error: undefined });
      const formData = documentUploadBody(inscricaoId, usuarioID, entry.category, entry.file);
      try {
        await api<unknown>(`/documentos/${encodeURIComponent(inscricaoId)}/enviar`, {
          method: "POST",
          token,
          body: formData,
        });
        results.set(entry.key, { status: "uploaded" });
        uploadedCount += 1;
      } catch (error) {
        const message = getErrorMessage(error);
        results.set(entry.key, { status: "failed", error: message });
        failures.push(`${entry.file.name}: ${message}`);
      }
    }

    const updatedFiles = files.map((entry) => {
      const result = results.get(entry.key);
      return result ? { ...entry, ...result } : entry;
    });
    setFiles(updatedFiles);
    setSaving(false);

    const stillInvalid = updatedFiles.some((entry) => entry.status === "invalid");
    const stillFailed = updatedFiles.some((entry) => entry.status === "failed");
    if (stillFailed || stillInvalid) {
      const uploadedTotal = updatedFiles.filter((entry) => entry.status === "uploaded").length;
      const details = [
        uploadedCount > 0 ? `${uploadedCount} arquivo(s) enviado(s) nesta tentativa.` : "",
        failures.length > 0 ? `Falhas: ${failures.join(" ")}` : "",
        stillInvalid
          ? `Arquivos inválidos: ${updatedFiles
              .filter((entry) => entry.status === "invalid")
              .map((entry) => `${entry.file.name} (${entry.error})`)
              .join("; ")}`
          : "",
        uploadedTotal > 0
          ? `${uploadedTotal} arquivo(s) já confirmado(s); eles não serão enviados novamente.`
          : "",
      ].filter(Boolean);
      setFeedback({ message: details.join(" "), isError: true });
      return;
    }

    completeEnrollment(token);
  }

  function completeEnrollment(sessionToken: string) {
    try {
      updateEnrollmentDraft(sessionToken, inscricaoId, "RESUMO");
      router.push(`/aluno/inscricoes/${encodeURIComponent(inscricaoId)}/resumo`);
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? `Os documentos foram enviados, mas não foi possível salvar o progresso da inscrição: ${error.message}`
            : "Os documentos foram enviados, mas não foi possível salvar o progresso da inscrição.",
        isError: true,
      });
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
          Documentos (PDF, JPEG ou PNG; até 5 MiB por arquivo)
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            multiple
            disabled={saving}
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>

        {files.length > 0 && (
          <ul className="enrollment-file-list" aria-label="Documentos selecionados">
            {files.map((entry) => (
              <li key={entry.key}>
                <div className="enrollment-file-details">
                  <strong>{entry.file.name}</strong>
                  <label>
                    Categoria
                    <select
                      value={entry.category}
                      disabled={saving || entry.status === "uploaded"}
                      onChange={(event) =>
                        updateFile(entry.key, { category: event.target.value as Category })
                      }
                    >
                      {CATEGORIES.map((category) => (
                        <option value={category} key={category}>{categoryLabel(category)}</option>
                      ))}
                    </select>
                  </label>
                  <span className="enrollment-file-status" role="status">
                    {statusLabel(entry)}
                  </span>
                </div>
                {entry.status !== "uploaded" && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={saving}
                    onClick={() => setFiles((current) => current.filter((file) => file.key !== entry.key))}
                  >
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="profile-actions">
          <button className="btn" type="submit" disabled={saving || files.length === 0}>
            {saving ? "Enviando documentos…" : "Enviar documentos"}
          </button>
        </div>
      </form>
    </div>
  );
}

function statusLabel(entry: DocumentFile): string {
  switch (entry.status) {
    case "pending":
      return "Pendente de envio";
    case "sending":
      return "Enviando…";
    case "uploaded":
      return "Enviado";
    case "failed":
      return `Falha no envio: ${entry.error}`;
    case "invalid":
      return `Inválido: ${entry.error}`;
  }
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Não foi possível enviar o documento.";
  }
  if (error.status === 400) {
    return error.message === "Algo deu errado."
      ? "O documento foi rejeitado. Confira o formato, tamanho e categoria."
      : `O documento foi rejeitado: ${error.message}`;
  }
  if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
  if (error.status === 403) {
    return "Você não tem permissão para enviar documentos nesta inscrição.";
  }
  if (error.status === 404) {
    return error.message === "Algo deu errado."
      ? "Inscrição não encontrada. Volte ao catálogo e retome o fluxo de inscrição."
      : error.message;
  }
  if (error.status === 413) return "O arquivo excede o limite de 5 MiB.";
  return error.message;
}
