"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";

type Course = {
  id: string;
  nome: string;
  instituicao: string;
  campus: string;
  cargaHoraria: string;
  periodo: string;
  horario: string;
  vagasDisponiveis: number;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readNestedText(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return readText(value);
  return readText(value.nome) ?? readText(value[key]);
}

function readFirstText(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readText(record[key]);
    if (value) return value;
  }
  return undefined;
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

function parseCourse(value: unknown, index: number): Course {
  if (!isRecord(value)) {
    throw new ApiError(`O curso na posição ${index + 1} possui formato inválido.`, 502);
  }

  const nome = readFirstText(value, ["nome", "titulo"]);
  const status = readFirstText(value, ["status", "situacao"]);
  const vacanciesValue = value.vagasDisponiveis;
  const vagasDisponiveis =
    typeof vacanciesValue === "number"
      ? vacanciesValue
      : typeof vacanciesValue === "string" && vacanciesValue.trim()
        ? Number(vacanciesValue)
        : Number.NaN;

  if (!nome || !status || !Number.isFinite(vagasDisponiveis)) {
    throw new ApiError(
      `A API retornou dados incompletos para o curso na posição ${index + 1}.`,
      502,
    );
  }

  const institution = value.instituicao;
  const campusValue = value.campus ?? (isRecord(institution) ? institution.campus : undefined);
  const institutionName =
    readNestedText(institution, "nomeInstituicao") ??
    readFirstText(value, ["nomeInstituicao", "instituicaoNome"]);
  const campusName =
    readNestedText(campusValue, "nomeCampus") ??
    readFirstText(value, ["nomeCampus", "campusNome"]);
  const startDate = readDate(value, ["dataInicio", "inicio"]);
  const endDate = readDate(value, ["dataFim", "fim"]);
  const period =
    startDate && endDate
      ? `${startDate} a ${endDate}`
      : startDate ?? endDate ?? "Não informado";
  const cargaHoraria = readFirstText(value, ["cargaHoraria", "cargaHorariaTotal"]);
  const id = readFirstText(value, ["id", "codigo"]) ?? `${nome}-${index}`;

  return {
    id,
    nome,
    instituicao: institutionName ?? "Não informado",
    campus: campusName ?? "Não informado",
    cargaHoraria: cargaHoraria
      ? /^\d+(\.\d+)?$/.test(cargaHoraria)
        ? `${cargaHoraria} horas`
        : cargaHoraria
      : "Não informado",
    periodo: period,
    horario: readSchedule(value),
    vagasDisponiveis,
    status: status.trim().toUpperCase(),
  };
}

function parseCourses(value: unknown): Course[] {
  let courses: unknown;

  if (Array.isArray(value)) {
    courses = value;
  } else if (isRecord(value)) {
    if (Array.isArray(value.cursos)) courses = value.cursos;
    else if (Array.isArray(value.content)) courses = value.content;
    else if (Array.isArray(value.data)) courses = value.data;
  }

  if (!Array.isArray(courses)) {
    throw new ApiError("A API retornou um formato inválido para a lista de cursos.", 502);
  }

  return courses.map(parseCourse);
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function CourseSkeleton() {
  return (
    <div className="course-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const institutionLine =
    course.campus === "Não informado"
      ? course.instituicao
      : `${course.instituicao} · ${course.campus}`;

  return (
    <article className="card course-card">
      <div className="course-card-heading">
        <h2>{course.nome}</h2>
        {course.vagasDisponiveis <= 0 && (
          <span className="course-sold-out">Esgotado</span>
        )}
      </div>
      <p className="course-institution">{institutionLine}</p>
      <dl className="course-details">
        <div>
          <dt>Carga horária</dt>
          <dd>{course.cargaHoraria}</dd>
        </div>
        <div>
          <dt>Datas</dt>
          <dd>{course.periodo}</dd>
        </div>
        <div>
          <dt>Horário</dt>
          <dd>{course.horario}</dd>
        </div>
      </dl>
      <p className="course-vacancies">
        {course.vagasDisponiveis <= 0
          ? "Não há vagas disponíveis"
          : `${course.vagasDisponiveis.toLocaleString("pt-BR")} vagas disponíveis`}
      </p>
    </article>
  );
}

export default function CoursesCatalog() {
  const { token } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      setLoading(true);
      setError("");

      if (!token) {
        setError("Sua sessão não está disponível. Entre novamente.");
        setLoading(false);
        return;
      }

      try {
        const response = await api<unknown>("/cursos/", { token });
        const result = parseCourses(response);
        if (active) setCourses(result);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os cursos.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCourses();
    return () => {
      active = false;
    };
  }, [token, retry]);

  const ongoingCourses = useMemo(
    () => courses.filter((course) => course.status === "ANDAMENTO"),
    [courses],
  );
  const institutions = useMemo(
    () => [...new Set(ongoingCourses.map((course) => course.instituicao))]
      .filter((institution) => institution !== "Não informado")
      .sort((left, right) => left.localeCompare(right, "pt-BR")),
    [ongoingCourses],
  );
  const visibleCourses = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);
    return ongoingCourses.filter((course) => {
      const matchesName = normalizeSearch(course.nome).includes(normalizedSearch);
      const matchesInstitution =
        !institutionFilter || course.instituicao === institutionFilter;
      return matchesName && matchesInstitution;
    });
  }, [ongoingCourses, search, institutionFilter]);

  function retryLoading() {
    setError("");
    setLoading(true);
    setRetry((count) => count + 1);
  }

  return (
    <div className="courses-page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Cursos em andamento</h1>
          <p className="muted">Encontre cursos disponíveis para você.</p>
        </div>
      </header>

      {error ? (
        <section className="card courses-message">
          <p className="alert" role="alert">{error}</p>
          <button className="btn" type="button" onClick={retryLoading}>
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <section className="card courses-filters" aria-label="Filtros de cursos">
            <label>
              Buscar por nome
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ex.: Introdução à pesquisa"
              />
            </label>
            <label>
              Instituição
              <select
                value={institutionFilter}
                onChange={(event) => setInstitutionFilter(event.target.value)}
              >
                <option value="">Todas as instituições</option>
                {institutions.map((institution) => (
                  <option value={institution} key={institution}>{institution}</option>
                ))}
              </select>
            </label>
          </section>

          {loading ? (
            <div className="courses-grid" role="status" aria-label="Carregando cursos">
              {Array.from({ length: 6 }, (_, index) => <CourseSkeleton key={index} />)}
            </div>
          ) : visibleCourses.length > 0 ? (
            <div className="courses-grid">
              {visibleCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <section className="card courses-empty" role="status">
              <h2>
                {ongoingCourses.length === 0
                  ? "Nenhum curso em andamento disponível"
                  : "Nenhum curso encontrado"}
              </h2>
              <p className="muted">
                {ongoingCourses.length === 0
                  ? "Novos cursos aparecerão aqui quando estiverem em andamento."
                  : "Tente alterar a busca ou selecionar outra instituição."}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
