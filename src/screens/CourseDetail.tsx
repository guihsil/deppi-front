"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { readCourseCapacity } from "../lib/course-capacity";
import {
  getEnrollmentDraftForCourse,
  saveEnrollmentDraft,
  type EnrollmentDraft,
} from "../lib/enrollment-drafts";

const COURSE_STATUSES = ["ANALISE", "ANDAMENTO", "CONCLUIDO", "FECHADO"] as const;
type CourseStatus = (typeof COURSE_STATUSES)[number];
const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  ANALISE: "Em análise",
  ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  FECHADO: "Fechado",
};

type CourseDetailModel = {
  nome: string;
  descricao: string;
  instituicao: string;
  campus: string;
  capa?: string;
  cargaHoraria: string;
  periodo: string;
  horario: string;
  vagasDisponiveis?: number;
  vagasTotais?: number;
  status: CourseStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readFirstText(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readText(record[key]);
    if (value) return value;
  }
  return undefined;
}

function readNestedText(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  return readText(value.nome) ?? readText(value[key]);
}

function isCourseStatus(value: string): value is CourseStatus {
  return COURSE_STATUSES.some((status) => status === value);
}

function readDate(record: Record<string, unknown>, keys: string[]): string | undefined {
  const value = readFirstText(record, keys);
  if (!value) return undefined;

  const brazilianDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilianDate) return `${brazilianDate[1]}/${brazilianDate[2]}/${brazilianDate[3]}`;

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!isoDate) return value;

  const date = new Date(`${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function readSchedule(record: Record<string, unknown>): string {
  const directSchedule = readText(record.horario);
  if (directSchedule) return directSchedule;

  const schedule = isRecord(record.horario) ? record.horario : undefined;
  const start =
    readFirstText(record, ["horarioInicio", "horaInicio"]) ??
    (schedule && readFirstText(schedule, ["inicio", "horarioInicio", "horaInicio"]));
  const end =
    readFirstText(record, ["horarioFim", "horaFim"]) ??
    (schedule && readFirstText(schedule, ["fim", "horarioFim", "horaFim"]));

  if (start && end) return `${start} às ${end}`;
  return start ?? end ?? "Não informado";
}

function normalizeCourseDetail(value: unknown): CourseDetailModel {
  const source = isRecord(value)
    ? isRecord(value.curso)
      ? value.curso
      : isRecord(value.data)
        ? value.data
        : isRecord(value.course)
          ? value.course
          : value
    : undefined;

  if (!source || !isRecord(source)) {
    throw new ApiError("A API retornou um curso inválido.", 502);
  }

  const nome = readFirstText(source, ["nome", "titulo"]);
  if (!nome) {
    throw new ApiError("A API não retornou o nome do curso.", 502);
  }
  const descricao =
    readFirstText(source, ["descricao", "descricaoCurso", "resumo", "detalhes"]) ??
    "Descrição não informada.";
  const institution = source.Instituicao ?? source.instituicao;
  const institutionName =
    readNestedText(institution, "nome") ??
    readNestedText(institution, "nomeInstituicao") ??
    readFirstText(source, ["nomeInstituicao", "instituicaoNome", "instituicao"]);
  const institutionCampus = isRecord(institution) ? institution.campus : undefined;
  const campus =
    readNestedText(source.campus, "nome") ??
    readNestedText(source.campus, "nomeCampus") ??
    readNestedText(institutionCampus, "nomeCampus") ??
    readFirstText(source, ["nomeCampus", "campusNome", "campus"]) ??
    "Não informado";
  const startDate = readDate(source, ["dataInicio", "inicio"]);
  const endDate = readDate(source, ["dataFim", "fim"]);
  const periodo =
    startDate && endDate ? `${startDate} a ${endDate}` : startDate ?? endDate ?? "Não informado";
  const cargaHoraria =
    readFirstText(source, ["cargaHoraria", "cargaHorariaTotal", "carga_horaria"]) ??
    "Não informado";
  const capacity = readCourseCapacity(source);
  const rawStatus = readFirstText(source, ["status", "situacao", "estado"])?.toUpperCase();
  if (!rawStatus || !isCourseStatus(rawStatus)) {
    throw new ApiError("A API retornou um status inválido para o curso.", 502);
  }
  const status = rawStatus;
  const capa =
    readText(source.capa) ??
    readText(source.imagem) ??
    readText(source.foto) ??
    readText(source.cover);

  return {
    nome,
    descricao,
    instituicao: institutionName ?? "Não informado",
    campus,
    capa,
    cargaHoraria: /^\d+(\.\d+)?$/.test(cargaHoraria)
      ? `${cargaHoraria} horas`
      : cargaHoraria,
    periodo,
    horario: readSchedule(source),
    vagasDisponiveis: capacity.availableSeats,
    vagasTotais: capacity.totalSeats,
    status,
  };
}

export default function CourseDetail() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const routeId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { token, cargos } = useAuth();
  const [course, setCourse] = useState<CourseDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollmentNotice, setEnrollmentNotice] = useState("");
  const [enrollmentDraft, setEnrollmentDraft] = useState<EnrollmentDraft>();
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCourse() {
      setLoading(true);
      setError("");

      if (!routeId) {
        if (active) {
          setError("Curso inválido.");
          setCourse(null);
          setLoading(false);
        }
        return;
      }

      if (!token) {
        if (active) {
          setError("Sua sessão não está disponível. Entre novamente.");
          setCourse(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await api<unknown>(`/cursos/${encodeURIComponent(routeId)}`, { token });
        const data = normalizeCourseDetail(response);
        if (active) {
          setCourse(data);
          try {
            setEnrollmentDraft(getEnrollmentDraftForCourse(token, routeId));
          } catch (draftError) {
            setEnrollmentNotice(
              draftError instanceof Error
                ? draftError.message
                : "Não foi possível recuperar o progresso salvo da inscrição.",
            );
          }
        }
      } catch (loadError) {
        if (active) {
          const message =
            loadError instanceof ApiError && loadError.status === 404
              ? "Curso não encontrado ou indisponível."
              : loadError instanceof Error
                ? loadError.message
                : "Não foi possível carregar os detalhes do curso.";
          setError(message);
          setCourse(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCourse();
    return () => {
      active = false;
    };
  }, [routeId, token]);

  async function startOrResumeEnrollment() {
    if (!token || !routeId || !course) {
      setEnrollmentNotice("Sua sessão ou os dados do curso não estão disponíveis. Tente novamente.");
      return;
    }

    setEnrollmentNotice("");
    setEnrolling(true);
    try {
      const savedDraft = getEnrollmentDraftForCourse(token, routeId);
      if (savedDraft) {
        setEnrollmentDraft(savedDraft);
        router.push(
          savedDraft.etapa === "RESUMO"
            ? `/aluno/inscricoes/${encodeURIComponent(savedDraft.id)}/resumo`
            : `/aluno/inscricoes/${encodeURIComponent(savedDraft.id)}/${savedDraft.etapa.toLowerCase()}`,
        );
        return;
      }

      const response = await api<unknown>("/inscricoes", {
        method: "POST",
        token,
        body: { cursoId: routeId },
      });
      const inscricaoId = readEnrollmentId(response);
      const draft: EnrollmentDraft = {
        id: inscricaoId,
        cursoId: routeId,
        cursoNome: course.nome,
        etapa: "RENDA",
        updatedAt: new Date().toISOString(),
      };

      try {
        saveEnrollmentDraft(token, draft);
      } catch (draftError) {
        setEnrollmentNotice(
          draftError instanceof Error
            ? `A inscrição foi criada, mas não foi possível salvar o progresso: ${draftError.message}`
            : "A inscrição foi criada, mas não foi possível salvar o progresso.",
        );
      }
      router.push(`/aluno/inscricoes/${encodeURIComponent(inscricaoId)}/renda`);
    } catch (submitError) {
      setEnrollmentNotice(enrollmentErrorMessage(submitError, "inscrição"));
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return (
      <div className="course-detail-page">
        <header className="page-head">
          <div>
            <h1 className="page-title">Detalhes do curso</h1>
          </div>
          <Link href="/aluno" className="btn btn-ghost">
            Voltar
          </Link>
        </header>
        <div className="card course-detail-loading" aria-live="polite" aria-busy="true">
          Carregando informações do curso…
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="course-detail-page">
        <header className="page-head">
          <div>
            <h1 className="page-title">Detalhes do curso</h1>
          </div>
          <Link href="/aluno" className="btn btn-ghost">
            Voltar
          </Link>
        </header>
        <section className="card course-detail-alert" role="alert">
          <p>{error || "Curso não encontrado ou indisponível."}</p>
          <Link href="/aluno" className="btn">
            Voltar para cursos
          </Link>
        </section>
      </div>
    );
  }

  const isAluno = cargos.includes("ALUNO");
  const hasVacancies = course.vagasDisponiveis !== undefined && course.vagasDisponiveis > 0;
  const noVacancies = course.vagasDisponiveis === 0;
  const isEnrollmentOpen = course.status === "ANDAMENTO";
  const canEnroll = hasVacancies && isEnrollmentOpen;

  return (
    <div className="course-detail-page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Detalhes do curso</h1>
        </div>
        <Link href="/aluno" className="btn btn-ghost">
          Voltar
        </Link>
      </header>

      <article className="card course-detail-card">
        <div className="course-detail-hero">
          {course.capa ? (
            <img className="course-detail-cover" src={course.capa} alt={`Capa do curso ${course.nome}`} />
          ) : (
            <div className="course-detail-cover-placeholder" role="img" aria-label={`Capa não disponível para ${course.nome}`}>
              Capa do curso não disponível
            </div>
          )}
          <div className="course-detail-summary">
            <div className="course-detail-status-row">
              <span className={`course-badge ${canEnroll ? "available" : "sold-out"}`}>
                {canEnroll
                  ? "Inscrições abertas"
                  : noVacancies
                    ? "Sem vagas"
                    : isEnrollmentOpen
                      ? "Disponibilidade não informada"
                      : "Inscrições indisponíveis"}
              </span>
              <span className="course-badge subtle">{COURSE_STATUS_LABELS[course.status]}</span>
            </div>
            <h2>{course.nome}</h2>
            <p className="course-institution">
              {course.instituicao}
              {course.campus ? ` • ${course.campus}` : ""}
            </p>
            <dl className="course-detail-meta">
              <div>
                <dt>Carga horária</dt>
                <dd>{course.cargaHoraria}</dd>
              </div>
              <div>
                <dt>Período</dt>
                <dd>{course.periodo}</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>{course.horario}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="course-detail-body">
          <section className="course-detail-section">
            <h3>Descrição</h3>
            <p>{course.descricao}</p>
          </section>

          <aside className="course-detail-aside">
            <div className="course-detail-box">
              <span className="course-detail-label">Disponibilidade</span>
              <strong>
                {!isEnrollmentOpen
                  ? "Inscrições indisponíveis"
                  : course.vagasDisponiveis !== undefined && course.vagasDisponiveis > 0
                    ? `${course.vagasDisponiveis.toLocaleString("pt-BR")} vagas disponíveis`
                    : noVacancies
                      ? "Sem vagas disponíveis"
                      : course.vagasTotais !== undefined
                        ? `${course.vagasTotais.toLocaleString("pt-BR")} vagas totais`
                        : "Disponibilidade não informada"}
              </strong>
              <p className="muted">
                {canEnroll
                  ? "Você pode realizar a inscrição agora."
                  : !isEnrollmentOpen
                    ? "Este curso não está com inscrições abertas."
                    : noVacancies
                      ? "As inscrições para este curso estão encerradas."
                      : "Não foi possível confirmar a quantidade de vagas disponíveis."}
              </p>
            </div>

            {isAluno ? (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={(!canEnroll && !enrollmentDraft) || enrolling}
                  onClick={() => void startOrResumeEnrollment()}
                >
                  {enrolling
                    ? "Aguarde…"
                    : enrollmentDraft
                      ? enrollmentDraft.etapa === "RESUMO"
                        ? "Ver resumo da inscrição"
                        : "Continuar inscrição"
                      : canEnroll
                        ? "Inscrever-se"
                    : noVacancies
                      ? "Sem vagas"
                      : "Inscrições indisponíveis"}
                </button>
                {enrollmentNotice ? (
                  <p className="course-enrollment-notice" role="status">{enrollmentNotice}</p>
                ) : null}
              </>
            ) : null}
          </aside>
        </div>
      </article>
    </div>
  );
}

function readEnrollmentId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError("A API criou a inscrição, mas não retornou o identificador.", 502);
  }

  const record = value as Record<string, unknown>;
  for (const key of ["id", "inscricaoId"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }

  for (const key of ["inscricao", "data", "resultado"]) {
    if (record[key] !== undefined) {
      const id = findEnrollmentId(record[key]);
      if (id) return id;
    }
  }
  throw new ApiError("A API criou a inscrição, mas não retornou o identificador.", 502);
}

function findEnrollmentId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["id", "inscricaoId"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  for (const key of ["inscricao", "data", "resultado"]) {
    const id = findEnrollmentId(record[key]);
    if (id) return id;
  }
  return undefined;
}

function enrollmentErrorMessage(error: unknown, action: string): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : `Não foi possível realizar a ${action}.`;
  }
  if (error.status === 400) {
    if (error.message !== "Algo deu errado.") {
      return `Não foi possível realizar a ${action}: ${error.message}`;
    }
    return "Não foi possível concluir a inscrição. Verifique se já há uma inscrição ativa neste curso e se ainda existem vagas.";
  }
  if (error.status === 404) {
    if (error.message !== "Algo deu errado.") {
      return error.message;
    }
    return "Curso não encontrado ou indisponível para inscrição.";
  }
  return error.message;
}
