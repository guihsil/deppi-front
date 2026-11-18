"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import EnrollmentDocumentViewer from "../components/EnrollmentDocumentViewer";
import ReviewDialog from "../components/ReviewDialog";
import {
  actions, asApiError, canDecide, canRetry, courseEnrollmentPath, date, dateTime, ruleMessages, statusLabels,
  type Decision, type EnrollmentDetail, type EnrollmentDocument, type HistoryEvent,
} from "../lib/enrollment-review";

const actionLabels: Record<string, string> = {
  APROVAR: "Aprovação", REJEITAR: "Rejeição", CANCELAR: "Cancelamento",
};

const categoryLabels: Record<string, string> = {
  RG: "RG", CPF: "CPF", COMPROVANTE_RESIDENCIA: "Comprovante de residência",
  COMPROVANTE_RENDA: "Comprovante de renda", HISTORICO_ESCOLAR: "Histórico escolar", OUTRO: "Outro",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const size = new Intl.NumberFormat("pt-BR", { style: "unit", unit: "byte" });
const decisions = Object.keys(actions) as Decision[];

function LoadError({ error, retry, children }: {
  error: ApiError;
  retry: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="profile-card">
      <p className="profile-feedback error" role="alert">
        {children ?? (error.status === 403 ? "Você não tem permissão para acessar esta seção." : error.message)}
      </p>
      {canRetry(error) && (
        <div className="profile-actions">
          <button type="button" className="btn btn-ghost" onClick={retry}>Tentar novamente</button>
        </div>
      )}
    </div>
  );
}

function ReviewField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="profile-field">
      <dt className="profile-field-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function EnrollmentReview({ courseId, id }: { courseId: string; id: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const queuePath = courseEnrollmentPath(courseId);
  const path = `/inscricoes/${encodeURIComponent(id)}`;
  const [detail, setDetail] = useState<EnrollmentDetail | null>(null);
  const [detailError, setDetailError] = useState<ApiError | null>(null);
  const [documents, setDocuments] = useState<EnrollmentDocument[] | ApiError | null>(null);
  const [history, setHistory] = useState<HistoryEvent[] | ApiError | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<EnrollmentDocument | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [returning, startReturn] = useTransition();
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [decisionForbidden, setDecisionForbidden] = useState(false);
  const currentRequest = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const historyRequest = useRef(0);

  const loadDetail = useCallback(async (signal: AbortSignal) => {
    setDetailError(null);
    try {
      const { inscricao } = await api<{ inscricao: EnrollmentDetail }>(path, { token, signal, cache: "no-store" });
      if (inscricao.curso.id !== courseId) {
        throw new ApiError("Inscrição não encontrada neste curso.", 404);
      }
      if (!signal.aborted) setDetail(inscricao);
      return true;
    } catch (error) {
      if (!signal.aborted) {
        const failure = asApiError(error);
        if (failure.status === 403 || failure.status === 404) setDetail(null);
        setDetailError(failure);
      }
      return false;
    }
  }, [courseId, path, token]);

  const loadDocuments = useCallback(async (signal = currentRequest.current?.signal) => {
    setDocuments(null);
    try {
      const response = await api<{ documentos: EnrollmentDocument[] }>(`${path}/documentos`, { token, signal, cache: "no-store" });
      if (!signal?.aborted) setDocuments(response.documentos);
    } catch (error) {
      if (!signal?.aborted) setDocuments(asApiError(error));
    }
  }, [path, token]);

  const loadHistory = useCallback(async (signal = currentRequest.current?.signal) => {
    const request = ++historyRequest.current;
    try {
      const response = await api<{ historico: HistoryEvent[] }>(`${path}/historico`, { token, signal, cache: "no-store" });
      if (!signal?.aborted && request === historyRequest.current) setHistory(response.historico);
    } catch (error) {
      if (!signal?.aborted && request === historyRequest.current) setHistory(asApiError(error));
    }
  }, [path, token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    currentRequest.current = controller;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void loadDetail(controller.signal);
      void loadDocuments(controller.signal);
      void loadHistory(controller.signal);
    });
    return () => {
      controller.abort();
      currentRequest.current = null;
    };
  }, [token, loadDetail, loadDocuments, loadHistory]);

  async function refreshDecisionState() {
    const signal = currentRequest.current?.signal;
    if (!signal || signal.aborted) return;

    setRefreshing(true);
    const [detailLoaded] = await Promise.all([loadDetail(signal), loadHistory(signal)]);
    if (!signal.aborted) setNeedsRefresh(!detailLoaded);
    setRefreshing(false);
  }

  const actionsDisabled = !detail || Boolean(detailError) || sending || returning || refreshing || needsRefresh || decisionForbidden;

  function openDecision(action: Decision) {
    setReason("");
    setReasonError("");
    setDecisionError("");
    setDecision(action);
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const signal = currentRequest.current?.signal;
    if (!signal || signal.aborted || !decision || !detail || actionsDisabled ||
      sendingRef.current || !canDecide(decision, detail)) return;

    const motivo = reason.trim();
    if (decision !== "aprovar" && motivo && (motivo.length < 3 || motivo.length > 255)) {
      setReasonError("O motivo deve ter de 3 a 255 caracteres.");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setReasonError("");
    setDecisionError("");
    try {
      const { inscricao } = await api<{ inscricao: Omit<EnrollmentDetail, "rendaFamiliar"> }>(
        `${path}/${decision}`, {
          method: "PATCH",
          token,
          signal,
          body: decision === "aprovar" ? undefined : motivo ? { motivo } : {},
        },
      );
      if (signal.aborted) return;
      if (inscricao?.id !== id || inscricao.curso.id !== courseId || inscricao.status !== actions[decision].status) {
        throw new ApiError("Não foi possível confirmar a decisão na resposta da API.", 502);
      }
      historyRequest.current += 1;
      setDetail({ ...inscricao, rendaFamiliar: detail.rendaFamiliar });
      setHistory(inscricao.historico);
      setDecision(null);
      startReturn(() => router.replace(`${queuePath}?decisao=${decision}`));
    } catch (cause) {
      if (signal.aborted) return;
      const error = asApiError(cause);
      const fieldError = error.fieldErrors.find(({ campo }) => campo === "motivo");
      const rule = error.status === 400 ? ruleMessages.get(error.message) : undefined;
      if (fieldError) setReasonError(fieldError.mensagem);
      else setDecisionError(rule ?? error.message);

      if (error.status === 403) setDecisionForbidden(true);
      if (rule || canRetry(error)) await refreshDecisionState();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const historyError = history instanceof Error ? history : null;
  const events = Array.isArray(history)
    ? history
    : historyError && historyError.status !== 403 && historyError.status !== 401
      ? detail?.historico
      : undefined;

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="enrollment-review-heading">
          <h1>{detail?.aluno.usuario.nome ?? "Detalhes da inscrição"}</h1>
          {detail && <p className="muted">{detail.curso.nome}</p>}
        </div>
        <Link className="btn btn-ghost" href={queuePath}>Voltar para inscrições</Link>
      </header>

      {!detail && !detailError && <p className="muted" role="status">Carregando inscrição…</p>}
      {detailError && (
        <LoadError error={detailError} retry={() => void refreshDecisionState()}>
          {detailError.status === 403 ? "Você não tem permissão para analisar esta inscrição." : undefined}
        </LoadError>
      )}
      {returning && <p className="profile-feedback" role="status">Voltando para inscrições…</p>}
      {detail && (
        <>
          <div className="card">
            <div className="profile-grid">
              <section className="enrollment-review-field-group" aria-labelledby="student-heading">
                <h2 className="profile-section-title" id="student-heading">Aluno</h2>
                <dl>
                  <ReviewField label="Nome">{detail.aluno.usuario.nome}</ReviewField>
                  <ReviewField label="Matrícula">{detail.aluno.matricula}</ReviewField>
                  <ReviewField label="E-mail institucional">
                    {detail.aluno.usuario.emailInstitucional || "Não informado"}
                  </ReviewField>
                </dl>
              </section>

              <section className="enrollment-review-field-group" aria-labelledby="enrollment-heading">
                <h2 className="profile-section-title" id="enrollment-heading">Inscrição</h2>
                <dl>
                  <ReviewField label="Status"><strong>{statusLabels[detail.status]}</strong></ReviewField>
                  <ReviewField label="Data da inscrição">
                    <time dateTime={detail.data}>{date.format(new Date(detail.data))}</time>
                  </ReviewField>
                  <ReviewField label="Identificador">{detail.id}</ReviewField>
                </dl>
              </section>

              <section className="enrollment-review-field-group" aria-labelledby="course-heading">
                <h2 className="profile-section-title" id="course-heading">Curso</h2>
                <dl>
                  <ReviewField label="Nome">{detail.curso.nome}</ReviewField>
                  <ReviewField label="Vagas disponíveis">{detail.curso.vagas}</ReviewField>
                </dl>
              </section>

              <section className="enrollment-review-field-group" aria-labelledby="income-heading">
                <h2 className="profile-section-title" id="income-heading">Renda familiar</h2>
                {detail.rendaFamiliar ? (
                  <dl>
                    <ReviewField label="Renda total">
                      {currency.format(Number(detail.rendaFamiliar.rendaFamiliar))}
                    </ReviewField>
                    <ReviewField label="Número de pessoas">{detail.rendaFamiliar.numeroPessoas}</ReviewField>
                  </dl>
                ) : <p className="muted">Renda familiar não informada</p>}
              </section>
            </div>
          </div>

          <section className="card profile-card enrollment-review-section" aria-labelledby="docs-heading">
            <h2 className="profile-section-title" id="docs-heading">Documentos</h2>
            {documents === null && <p role="status">Carregando documentos…</p>}
            {documents instanceof Error && <LoadError error={documents} retry={() => void loadDocuments()} />}
            {Array.isArray(documents) && (documents.length ? (
              <ul className="enrollment-review-rows">
                {documents.map((document) => (
                  <li key={document.id}>
                    <div>
                      <strong>{document.nomeOriginal}</strong>
                      <p>{document.categoria ? categoryLabels[document.categoria] ?? document.categoria : "Sem categoria"}
                        {" · "}{size.format(document.tamanho)}{" · "}{dateTime.format(new Date(document.criadoEm))}
                      </p>
                    </div>
                    <button type="button" className="btn btn-ghost" aria-label={`Visualizar ${document.nomeOriginal}`}
                      onClick={() => setSelectedDocument(document)}>Visualizar</button>
                  </li>
                ))}
              </ul>
            ) : <p>Nenhum documento enviado</p>)}
          </section>

          <section className="card profile-card enrollment-review-section" aria-labelledby="history-heading">
            <h2 className="profile-section-title" id="history-heading">Histórico de decisões</h2>
            {history === null && <p role="status">Carregando histórico…</p>}
            {historyError && <LoadError error={historyError} retry={() => {
              setHistory(null);
              void loadHistory();
            }}>{events ? "Não foi possível atualizar o histórico. Exibindo o histórico da inscrição." : undefined}</LoadError>}
            {events && (events.length ? (
              <ol className="enrollment-review-timeline">
                {events.map((item) => (
                  <li key={item.id}>
                    <h3>{actionLabels[item.alteracao] ?? item.alteracao}</h3>
                    <p>{item.descricao}</p>
                    <p>{statusLabels[item.statusAnterior]} → {statusLabels[item.statusAtual]}</p>
                    <p>{item.usuario.nome}{item.usuario.emailInstitucional && ` · ${item.usuario.emailInstitucional}`}</p>
                    <time dateTime={item.dataModificacao}>{dateTime.format(new Date(item.dataModificacao))}</time>
                  </li>
                ))}
              </ol>
            ) : <p>Nenhuma decisão registrada</p>)}
          </section>

          <section className="card profile-card enrollment-review-section" aria-labelledby="actions-heading">
            <h2 className="profile-section-title" id="actions-heading">Decisão sobre a inscrição</h2>
            <div className="profile-actions">
              {decisions.map((action) => (
                <button key={action} type="button" className={action === "aprovar" ? "btn" : "btn btn-ghost"}
                  disabled={actionsDisabled || !canDecide(action, detail)} onClick={() => openDecision(action)}>
                  {actions[action].label}
                </button>
              ))}
            </div>
            {decisionForbidden && (
              <p className="profile-feedback error" role="alert">Você não tem permissão para registrar decisões.</p>
            )}
          </section>

          {selectedDocument && <EnrollmentDocumentViewer document={selectedDocument} onClose={() => setSelectedDocument(null)} />}
          {decision && (
            <ReviewDialog title={`${actions[decision].label} inscrição`} onClose={() => setDecision(null)} busy={sending}>
              <p><strong>{detail.aluno.usuario.nome}</strong> · {detail.curso.nome}</p>
              <form className="profile-card" onSubmit={submitDecision} noValidate>
                {decision !== "aprovar" && (
                  <div>
                    <label htmlFor="decision-reason">Motivo (opcional)</label>
                    <textarea id="decision-reason" value={reason} rows={3} disabled={sending}
                      aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? "reason-error" : undefined}
                      onChange={(event) => { setReason(event.target.value); setReasonError(""); }} />
                    {reasonError && <p id="reason-error" className="profile-feedback error" role="alert">{reasonError}</p>}
                  </div>
                )}
                {decisionError && <p className="profile-feedback error" role="alert">{decisionError}</p>}
                {detailError && needsRefresh && (
                  <LoadError error={detailError} retry={() => void refreshDecisionState()}>Não foi possível confirmar o estado atual da inscrição.</LoadError>
                )}
                {sending && <p role="status">Enviando decisão…</p>}
                <div className="profile-actions">
                  <button type="button" className="btn btn-ghost" disabled={sending} onClick={() => setDecision(null)}>Voltar</button>
                  <button type="submit" className="btn" disabled={actionsDisabled || !canDecide(decision, detail)}>
                    {actions[decision].label}
                  </button>
                </div>
              </form>
            </ReviewDialog>
          )}
        </>
      )}
    </div>
  );
}
