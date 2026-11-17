"use client";

import { useEffect, useMemo, useState } from "react";
import CourseCover from "../components/CourseCover";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

type CourseSummary = {
  id: string;
  nome: string;
  status: string;
  vagasDisponiveis: number;
  totalVagas: number;
  inscritos: number;
  capaUrl?: string | null;
  instituicao?: string;
};

type Student = {
  id: string;
  nome: string;
  email?: string;
  matricula?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readNestedText(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return readText(value.nome) ?? readText(value.titulo) ?? readText(value.name);
}

function readCoverUrl(value: unknown): string | null {
  if (!isRecord(value)) return null;

  const record = value as Record<string, unknown>;
  const nestedCourse = isRecord(record.curso) ? record.curso : undefined;

  const directCandidates = [
    record.capa,
    record.capaUrl,
    record.cover,
    record.coverUrl,
    record.imagem,
    record.imagemUrl,
    record.foto,
    record.banner,
    record.url,
    record.src,
  ];

  for (const candidate of directCandidates) {
    const text = readText(candidate);
    if (text) return text;
  }

  const nestedCandidates = [
    nestedCourse?.capa,
    nestedCourse?.capaUrl,
    nestedCourse?.cover,
    nestedCourse?.imagem,
    record.capaPublica,
    record.urlPublica,
    record.publicUrl,
  ];

  for (const candidate of nestedCandidates) {
    const text = readText(candidate);
    if (text) return text;
  }

  return null;
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    if (Array.isArray(value.itens)) return value.itens;
    if (Array.isArray(value.resultado)) return value.resultado;
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.cursos)) return value.cursos;
    if (Array.isArray(value.alunos)) return value.alunos;
    if (Array.isArray(value.inscritos)) return value.inscritos;
  }
  return [];
}

function normalizeCourseSummary(value: unknown): CourseSummary | null {
  if (!isRecord(value)) return null;

  const id = readText(value.id) ?? readText(value.codigo) ?? readText(value.cursoId) ?? readText(value.uuid);
  const nome = readText(value.nome) ?? readText(value.titulo) ?? readNestedText(value.curso) ?? "Curso";
  if (!id || !nome) return null;

  const totalVagas = readNumber(value.vagas) ?? readNumber(value.totalVagas) ?? readNumber(value.vagasTotais) ?? readNumber(value.vagasDisponiveis) ?? 0;
  const inscricoes = Array.isArray(value.inscricoes) ? value.inscricoes.length : undefined;
  const vagasDisponiveis =
    readNumber(value.vagasDisponiveis) ??
    readNumber(value.vagas_disponiveis) ??
    readNumber(value.vagasRestantes) ??
    Math.max(0, (totalVagas ?? 0) - (readNumber(value.inscritos) ?? 0));
  const inscritos =
    readNumber(value.totalInscricoes) ??
    readNumber(value.inscritos) ??
    readNumber(value.quantidadeInscritos) ??
    readNumber(value.totalInscritos) ??
    inscricoes ??
    0;
  const status = readText(value.status) ?? readText(value.situacao) ?? "ANDAMENTO";
  const instituicao = isRecord(value.Instituicao) ? value.Instituicao : undefined;

  return {
    id,
    nome,
    status: status.toUpperCase(),
    vagasDisponiveis: Number.isFinite(vagasDisponiveis) ? vagasDisponiveis : 0,
    totalVagas: Number.isFinite(totalVagas) ? totalVagas : Math.max(0, vagasDisponiveis + inscritos),
    inscritos: Number.isFinite(inscritos) ? inscritos : 0,
    capaUrl: readCoverUrl(value),
    instituicao:
      readText(value.instituicao) ??
      readText(value.nomeInstituicao) ??
      readText(value.instituicaoNome) ??
      readText(instituicao?.nome),
  };
}

function normalizeStudent(value: unknown): Student | null {
  if (!isRecord(value)) return null;

  const id = readText(value.id) ?? readText(value.usuarioId) ?? readText(value.codigo) ?? readText(value.alunoId);
  const nome =
    readText(value.nomeSocial) ??
    readText(value.nome) ??
    readText(value.nomeCompleto) ??
    readText(value.nomeAluno) ??
    [readText(value.primeiroNome), readText(value.sobrenome)].filter(Boolean).join(" ");
  if (!id || !nome) return null;

  return {
    id,
    nome,
    email: readText(value.email) ?? readText(value.emailInstitucional),
    matricula: readText(value.matricula) ?? readText(value.numeroMatricula),
  };
}

type ProfessorCoursesResult = {
  courses: CourseSummary[];
  studentsByCourse: Record<string, Student[]>;
};

function normalizeProfessorCoursesPayload(value: unknown): ProfessorCoursesResult {
  const courses: CourseSummary[] = [];
  const studentsByCourse: Record<string, Student[]> = {};

  for (const row of readArray(value)) {
    const course = normalizeCourseSummary(row);
    if (!course) continue;

    courses.push(course);
    const enrollments = isRecord(row) && Array.isArray(row.inscricoes) ? row.inscricoes : [];
    studentsByCourse[course.id] = enrollments
      .map((enrollment) => {
        if (!isRecord(enrollment)) return null;
        return normalizeStudent(enrollment.aluno);
      })
      .filter((student): student is Student => student !== null);
  }

  return { courses, studentsByCourse };
}

async function resolveCourseCover(token: string, courseId: string): Promise<string | null> {
  try {
    const response = await api<unknown>(`/cursos/${encodeURIComponent(courseId)}/capa`, { token });
    if (!isRecord(response)) return null;

    const direct =
      readText(response.capa) ??
      readText(response.capaUrl) ??
      readText(response.url) ??
      readText(response.publicUrl) ??
      readText(response.imagem) ??
      readText(response.src);

    if (direct) return direct;

    if (isRecord(response.data)) {
      const nested =
        readText(response.data.capa) ??
        readText(response.data.capaUrl) ??
        readText(response.data.url) ??
        readText(response.data.publicUrl) ??
        readText(response.data.imagem) ??
        readText(response.data.src);
      if (nested) return nested;
    }
  } catch {
    // Alguns backends ainda não expõem a capa por este endpoint.
  }

  return null;
}

async function fetchProfessorCourses(token: string): Promise<ProfessorCoursesResult> {
  const response = await api<unknown>("/professores/me/cursos", { token });
  return normalizeProfessorCoursesPayload(response);
}

function formatStatusLabel(status: string): string {
  const normalized = status.toUpperCase();
  const labels: Record<string, string> = {
    ANDAMENTO: "Em andamento",
    ANALISE: "Em análise",
    CONCLUIDO: "Concluído",
    FECHADO: "Fechado",
    PENDENTE: "Pendente",
    DEFERIDO: "Deferida",
    INDEFERIDO: "Indeferida",
    CANCELADO: "Cancelada",
  };

  return labels[normalized] ?? normalized;
}

export default function ProfessorCourses() {
  const { token } = useAuth();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseStudents, setCourseStudents] = useState<Record<string, Student[]>>({});
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!token) {
        setError("Sua sessão não está disponível. Entre novamente.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await fetchProfessorCourses(token);
        const hydratedCourses = await Promise.all(
          result.courses.map(async (course) => ({
            ...course,
            capaUrl: course.capaUrl ?? (await resolveCourseCover(token, course.id)),
          })),
        );

        if (!active) return;
        setCourses(hydratedCourses);
        setExpanded(hydratedCourses.map((course) => course.id));
        setCourseStudents(result.studentsByCourse);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os cursos e alunos inscritos.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [token]);

  const summary = useMemo(
    () => ({
      total: courses.length,
      vagas: courses.reduce((sum, course) => sum + course.vagasDisponiveis, 0),
      alunos: Object.values(courseStudents).reduce(
        (sum, students) => sum + students.length,
        0,
      ),
    }),
    [courses, courseStudents],
  );

  function toggleCourse(courseId: string) {
    setExpanded((current) =>
      current.includes(courseId)
        ? current.filter((value) => value !== courseId)
        : [...current, courseId],
    );
  }

  if (loading) {
    return <p className="center-msg" role="status">Carregando cursos do professor…</p>;
  }

  if (error) {
    return (
      <section className="card professor-page-message" role="alert">
        <h1>Meus cursos e inscritos</h1>
        <p className="alert">{error}</p>
      </section>
    );
  }

  return (
    <div className="professor-page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Meus cursos e inscritos</h1>
          <p className="muted">Acompanhamento dos próprios cursos e dos alunos inscritos.</p>
        </div>
      </header>

      <section className="stats" aria-label="Resumo dos cursos do professor">
        <div className="card stat tone-blue">
          <span className="stat-label">Cursos</span>
          <strong className="stat-value">{summary.total}</strong>
        </div>
        <div className="card stat tone-green">
          <span className="stat-label">Vagas disponíveis</span>
          <strong className="stat-value">{summary.vagas}</strong>
        </div>
        <div className="card stat tone-yellow">
          <span className="stat-label">Alunos inscritos</span>
          <strong className="stat-value">{summary.alunos}</strong>
        </div>
      </section>

      {courses.length === 0 ? (
        <section className="card">
          <h2>Sem cursos em acompanhamento</h2>
          <p className="muted">
            Ainda não há cursos associados a esse perfil de professor. O backend precisa expor a lista deste professor para esta tela.
          </p>
        </section>
      ) : (
        <div className="professor-course-list">
          {courses.map((course) => {
            const students = courseStudents[course.id] ?? [];
            const isExpanded = expanded.includes(course.id);

            return (
              <article key={course.id} className="card professor-course-card">
                <div className="professor-course-header">
                  <CourseCover src={course.capaUrl ?? null} alt={`Capa do curso ${course.nome}`} className="professor-course-cover" />
                  <div className="professor-course-meta">
                    <div className="professor-course-title-row">
                      <h2>{course.nome}</h2>
                      <span className="course-status-badge">{formatStatusLabel(course.status)}</span>
                    </div>
                    {course.instituicao && <p className="muted">{course.instituicao}</p>}
                    <div className="professor-course-stats">
                      <span>{course.totalVagas || course.vagasDisponiveis + course.inscritos} vagas</span>
                      <span>{course.vagasDisponiveis} disponíveis</span>
                      <span>{course.inscritos} inscritos</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost professor-toggle"
                  onClick={() => toggleCourse(course.id)}
                >
                  {isExpanded ? "Ocultar alunos" : "Ver alunos inscritos"}
                </button>

                {isExpanded && (
                  <div className="professor-students">
                    <h3>Alunos inscritos</h3>
                    {students.length === 0 ? (
                      <p className="muted">Nenhum aluno inscrito neste curso.</p>
                    ) : (
                      <ul>
                        {students.map((student) => (
                          <li key={student.id}>
                            <strong>{student.nome}</strong>
                            {student.matricula && <span>{student.matricula}</span>}
                            {student.email && <small>{student.email}</small>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
