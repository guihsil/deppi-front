"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { readCourseCapacity } from "../lib/course-capacity";

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
  const routeId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { token, cargos } = useAuth();
  const [course, setCourse] = useState<CourseDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollmentNotice, setEnrollmentNotice] = useState("");

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
        if (active) setCourse(data);
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
                  disabled={!canEnroll}
                  onClick={() => setEnrollmentNotice("A inscrição ainda não está integrada à API.")}
                >
                  {canEnroll
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
