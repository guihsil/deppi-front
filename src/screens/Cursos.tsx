"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";

type Institution = {
  id: string;
  nome: string;
  cidade?: string;
  campus?: string;
};

type Course = {
  id: string;
  nome: string;
  cargaHoraria: number;
  vagas: number;
  dataInicio: string;
  dataFim: string;
  horarioInicio: string;
  horarioFim: string;
  fkInstituicao: string;
  instituicao?: string;
  status?: string;
  diasSemana?: string[];
  inscricoes?: number;
};

const COURSE_STATUSES = [
  { value: "ANALISE", label: "Em análise" },
  { value: "ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDO", label: "Concluído" },
  { value: "FECHADO", label: "Fechado" },
] as const;

type FormState = {
  nome: string;
  cargaHoraria: string;
  vagas: string;
  dataInicio: string;
  dataFim: string;
  horarioInicio: string;
  horarioFim: string;
  fkInstituicao: string;
  diasSemana: string[];
};

const emptyForm: FormState = {
  nome: "",
  cargaHoraria: "",
  vagas: "",
  dataInicio: "",
  dataFim: "",
  horarioInicio: "",
  horarioFim: "",
  fkInstituicao: "",
  diasSemana: [],
};

const DAYS = [
  { value: "SEG", label: "Seg" },
  { value: "TER", label: "Ter" },
  { value: "QUA", label: "Qua" },
  { value: "QUI", label: "Qui" },
  { value: "SEX", label: "Sex" },
  { value: "SAB", label: "Sáb" },
  { value: "DOM", label: "Dom" },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function institutionLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sua sessão expirou. Entre novamente para carregar as instituições.";
    if (error.status === 403) {
      return `${error.message} A API negou GET /instituicao para esta sessão; confirme se o backend permite a listagem ao cargo PROFESSOR.`;
    }
    return error.message;
  }
  return "Não foi possível carregar as instituições.";
}

function inputDate(value: unknown): string {
  const text = readText(value);
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const brazilianDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return brazilianDate ? `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}` : text;
}

function inputTime(value: unknown): string {
  const text = readText(value);
  const time = text.match(/(?:T|\b)(\d{2}:\d{2})/);
  return time?.[1] ?? text.slice(0, 5);
}

function normalizeInstitution(value: unknown): Institution | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id ?? value.codigo ?? value.instituicaoId ?? value.instituicao_id ?? value._id);
  const nome = readText(
    value.nome ??
      value.nomeInstituicao ??
      value.nome_instituicao ??
      value.instituicaoNome ??
      value.titulo,
  );
  const cidade = readText(value.cidade ?? value.localidade ?? value.cidadeNome ?? value.municipio);
  const campus = readText(value.campus ?? value.nomeCampus ?? value.campusNome ?? value.unidade);
  if (!id || !nome) return null;
  return {
    id,
    nome,
    ...(cidade ? { cidade } : {}),
    ...(campus ? { campus } : {}),
  };
}

function parseInstitutions(value: unknown): Institution[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.instituicoes)
      ? value.instituicoes
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : isRecord(value) && Array.isArray(value.content)
          ? value.content
          : null;

  if (!rows) throw new ApiError("A API retornou um formato inválido para a lista de instituições.", 502);
  return rows.map((item, index) => {
    const institution = normalizeInstitution(item);
    if (!institution) {
      throw new ApiError(
        `A API retornou dados inválidos para a instituição na posição ${index + 1}.`,
        502,
      );
    }
    return institution;
  });
}

function normalizeCourse(value: unknown): Course | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id ?? value.codigo ?? value.cursoId);
  if (!id) return null;

  const hours = Number(readText(value.carga_horaria ?? value.cargaHoraria ?? value.cargaHorariaTotal ?? "0"));
  const vagas = Number(readText(value.vagas ?? value.vagasDisponiveis ?? value.quantidadeVagas ?? "0"));
  const dataInicio = inputDate(value.dataInicio ?? value.inicio ?? value.data_inicio);
  const dataFim = inputDate(value.dataFim ?? value.fim ?? value.data_fim);
  const horario = isRecord(value.horario) ? value.horario : undefined;
  const horarioInicio = inputTime(value.horarioInicio ?? value.horaInicio ?? (horario ? horario.inicio : undefined) ?? "");
  const horarioFim = inputTime(value.horarioFim ?? value.horaFim ?? (horario ? horario.fim : undefined) ?? "");
  const institution = value.Instituicao ?? value.instituicao;
  const fkInstituicao = readText(
    value.fkInstituicao ??
      value.instituicaoId ??
      value.idInstituicao ??
      (isRecord(institution) ? institution.id : undefined) ??
      "",
  );
  const enrollmentCount =
    isRecord(value._count) ? value._count.inscricao :
      value.inscricao ?? value.inscricoes ?? value.quantidadeInscricoes ?? value.totalInscricoes;
  const inscricoes = Array.isArray(enrollmentCount)
    ? enrollmentCount.length
    : typeof enrollmentCount === "number" && Number.isFinite(enrollmentCount)
      ? enrollmentCount
      : typeof enrollmentCount === "string" && enrollmentCount.trim() && Number.isFinite(Number(enrollmentCount))
        ? Number(enrollmentCount)
        : undefined;

  return {
    id,
    nome: readText(value.nome ?? value.titulo ?? "Curso"),
    cargaHoraria: Number.isFinite(hours) ? hours : 0,
    vagas: Number.isFinite(vagas) ? vagas : 0,
    dataInicio,
    dataFim,
    horarioInicio,
    horarioFim,
    fkInstituicao,
    instituicao: readText(
      (isRecord(institution) ? institution.nome : institution) ??
        value.nomeInstituicao ??
        value.instituicaoNome,
    ),
    status: readText(value.status ?? value.situacao ?? value.estado),
    diasSemana: Array.isArray(value.diasSemana) ? value.diasSemana.map((day) => String(day)) : [],
    inscricoes,
  };
}

function parseCourses(value: unknown): Course[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.cursos)
      ? value.cursos
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : null;

  if (!rows) throw new ApiError("A API retornou um formato inválido para a lista de cursos.", 502);
  return rows.map((item, index) => {
    const course = normalizeCourse(item);
    if (!course) {
      throw new ApiError(`A API retornou dados inválidos para o curso na posição ${index + 1}.`, 502);
    }
    return course;
  });
}

export default function CursosScreen({ mode = "deppi" }: { mode?: "deppi" | "professor" }) {
  const { token, cargos } = useAuth();
  const isProfessorMode = mode === "professor";
  const canManageStatus = !isProfessorMode && cargos.includes("DEPPI");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionCourseId, setActionCourseId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadData = useCallback(async () => {
    if (!token) {
      setError("Sua sessão não está disponível. Entre novamente.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    if (!isProfessorMode) {
      try {
        const coursesResponse = await api<unknown>("/cursos", { token });
        setCourses(parseCourses(coursesResponse));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os cursos.",
        );
      }
    }

    try {
      const institutionsResponse = await api<unknown>("/instituicao", { token });
      setInstitutions(parseInstitutions(institutionsResponse));
    } catch (loadError) {
      setError(institutionLoadErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [isProfessorMode, token]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedId) ?? null,
    [courses, selectedId],
  );

  const reviewQueue = useMemo(
    () => courses.filter((course) => course.status?.toUpperCase() === "ANALISE"),
    [courses],
  );

  const filteredCourses = useMemo(
    () =>
      statusFilter
        ? courses.filter((course) => course.status?.toUpperCase() === statusFilter)
        : courses,
    [courses, statusFilter],
  );

  function resetForm() {
    setSelectedId(null);
    setForm(emptyForm);
    setFeedback(null);
  }

  function updateField(field: keyof FormState, value: string | string[]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleDay(day: string) {
    setForm((current) => ({
      ...current,
      diasSemana: current.diasSemana.includes(day)
        ? current.diasSemana.filter((item) => item !== day)
        : [...current.diasSemana, day],
    }));
  }

  function handleEdit(course: Course) {
    setSelectedId(course.id);
    setForm({
      nome: course.nome,
      cargaHoraria: String(course.cargaHoraria),
      vagas: String(course.vagas),
      dataInicio: course.dataInicio,
      dataFim: course.dataFim,
      horarioInicio: course.horarioInicio,
      horarioFim: course.horarioFim,
      fkInstituicao: course.fkInstituicao,
      diasSemana: course.diasSemana ?? [],
    });
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const nome = form.nome.trim();
    const cargaHoraria = Number(form.cargaHoraria);
    const vagas = Number(form.vagas);
    const horarioInicio = form.horarioInicio.trim();
    const horarioFim = form.horarioFim.trim();
    const dataInicio = form.dataInicio;
    const dataFim = form.dataFim;

    if (!nome || !form.fkInstituicao) {
      setFeedback({ message: "Informe o nome do curso e a instituição.", ok: false });
      return;
    }

    if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
      setFeedback({ message: "A carga horária deve ser maior que zero.", ok: false });
      return;
    }

    if (!Number.isFinite(vagas) || vagas < 1) {
      setFeedback({ message: "A quantidade de vagas deve ser no mínimo 1.", ok: false });
      return;
    }

    if (!dataInicio || !dataFim || !horarioInicio || !horarioFim) {
      setFeedback({ message: "Informe as datas e os horários de início e fim.", ok: false });
      return;
    }

    if (
      selectedCourse?.inscricoes !== undefined &&
      vagas < selectedCourse.inscricoes
    ) {
      setFeedback({
        message: `Não é possível reduzir as vagas abaixo das ${selectedCourse.inscricoes} inscrições existentes.`,
        ok: false,
      });
      return;
    }

    if (dataFim && dataInicio && new Date(dataFim) < new Date(dataInicio)) {
      setFeedback({ message: "A data final deve ser maior ou igual à data inicial.", ok: false });
      return;
    }

    const body = {
      nome,
      carga_horaria: cargaHoraria,
      vagas,
      dataInicio,
      dataFim,
      horarioInicio,
      horarioFim,
      fkInstituicao: form.fkInstituicao,
      diasSemana: form.diasSemana,
    };

    setSaving(true);
    setFeedback(null);
    let successMessage: string;
    try {
      if (selectedId) {
        await api<unknown>(`/cursos/${encodeURIComponent(selectedId)}`, {
          method: "PUT",
          token,
          body: { ...body, id: selectedId },
        });
        successMessage = "Curso atualizado com sucesso.";
      } else {
        if (!isProfessorMode) return;
        await api<unknown>("/cursos", {
          method: "POST",
          token,
          body,
        });
        successMessage = "Curso enviado para análise. A equipe DEPPI fará a avaliação.";
      }

      resetForm();
      setFeedback({ message: successMessage, ok: true });
      if (!isProfessorMode) await loadData();
    } catch (submitError) {
      const message = submitError instanceof ApiError
        ? submitError.status === 403
          ? `${submitError.message} A API negou esta operação para a sessão atual; confirme no backend se o cargo PROFESSOR pode criar cursos.`
          : submitError.message
        : "Não foi possível salvar o curso.";
      setFeedback({ message, ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || !canManageStatus) return;
    const course = courses.find((item) => item.id === id);
    const confirmed = window.confirm(
      course ? `Deseja excluir o curso ${course.nome}?` : "Deseja excluir este curso?",
    );

    if (!confirmed) return;

    setActionCourseId(id);
    setFeedback(null);
    try {
      await api<unknown>(`/cursos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        token,
      });
      setFeedback({ message: "Curso removido com sucesso.", ok: true });
      resetForm();
      await loadData();
    } catch (deleteError) {
      const message =
        deleteError instanceof ApiError ? deleteError.message : "Não foi possível excluir o curso.";
      setFeedback({ message, ok: false });
    } finally {
      setActionCourseId(null);
    }
  }

  async function handleApprove(course: Course) {
    if (!token || !canManageStatus || course.status?.toUpperCase() !== "ANALISE") return;

    setActionCourseId(course.id);
    setFeedback(null);
    try {
      await api<unknown>(`/cursos/${encodeURIComponent(course.id)}`, {
        method: "PUT",
        token,
        body: { status: "ANDAMENTO" },
      });
      setFeedback({ message: `O curso "${course.nome}" foi aprovado.`, ok: true });
      await loadData();
    } catch (approveError) {
      const message =
        approveError instanceof ApiError
          ? approveError.message
          : "Não foi possível aprovar o curso.";
      setFeedback({ message, ok: false });
    } finally {
      setActionCourseId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-head">
        <div>
          <h1 className="page-title">
            {isProfessorMode ? "Cadastrar curso" : "Gestão de cursos"}
          </h1>
          <p className="muted">
            {isProfessorMode
              ? "Cadastre um curso para análise da equipe DEPPI."
              : "Consulte os cursos e analise as solicitações de aprovação."}
          </p>
        </div>
      </header>

      {canManageStatus && (
        <section className="card" aria-labelledby="review-queue-title">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="review-queue-title">Fila de cursos em análise</h2>
              <p className="muted">{reviewQueue.length} curso(s) aguardando aprovação.</p>
            </div>
          </div>
          {reviewQueue.length === 0 ? (
            <p className="muted mt-4">Não há cursos aguardando aprovação.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200">
              {reviewQueue.map((course) => (
                <li
                  key={course.id}
                  className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <h3 className="font-semibold">{course.nome}</h3>
                    <p className="muted">
                      {course.instituicao ?? "Instituição não informada"} · {course.vagas} vagas
                      {course.inscricoes !== undefined ? ` · ${course.inscricoes} inscrições` : ""}
                    </p>
                  </div>
                  <button
                    className="btn"
                    type="button"
                    disabled={actionCourseId !== null}
                    onClick={() => void handleApprove(course)}
                  >
                    {actionCourseId === course.id ? "Aprovando..." : "Aprovar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(isProfessorMode || selectedId !== null) && (
        <section className="card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2>{selectedId ? "Editar curso" : "Novo curso"}</h2>
            {selectedId && (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Cancelar edição
              </button>
            )}
          </div>

          {isProfessorMode && loading && <p className="muted mt-4">Carregando instituições…</p>}
          {isProfessorMode && error && (
            <div className="alert" role="alert">
              <p>{error}</p>
              <button
                className="btn btn-ghost mt-3"
                type="button"
                disabled={loading}
                onClick={() => void loadData()}
              >
                Tentar carregar novamente
              </button>
            </div>
          )}
          {isProfessorMode && !loading && !error && institutions.length === 0 && (
            <p className="muted mt-4">Não há instituições cadastradas para selecionar.</p>
          )}
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
            <label className="space-y-1 md:col-span-2">
              <span>Nome do curso</span>
              <input
                value={form.nome}
                onChange={(event) => updateField("nome", event.target.value)}
                placeholder="Ex.: Programação para web"
                required
              />
            </label>

            <label className="space-y-1">
              <span>Instituição</span>
              <select
                value={form.fkInstituicao}
                onChange={(event) => updateField("fkInstituicao", event.target.value)}
                disabled={loading || institutions.length === 0}
                required
              >
                <option value="">Selecione uma instituição</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.nome}
                    {institution.campus ? ` · ${institution.campus}` : ""}
                    {institution.cidade ? ` — ${institution.cidade}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span>Carga horária</span>
              <input
                type="number"
                min="1"
                value={form.cargaHoraria}
                onChange={(event) => updateField("cargaHoraria", event.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <span>Vagas</span>
              <input
                type="number"
                min="1"
                value={form.vagas}
                onChange={(event) => updateField("vagas", event.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <span>Data início</span>
              <input
                type="date"
                value={form.dataInicio}
                onChange={(event) => updateField("dataInicio", event.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <span>Data fim</span>
              <input
                type="date"
                value={form.dataFim}
                onChange={(event) => updateField("dataFim", event.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <span>Horário início</span>
              <input
                type="time"
                value={form.horarioInicio}
                onChange={(event) => updateField("horarioInicio", event.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <span>Horário fim</span>
              <input
                type="time"
                value={form.horarioFim}
                onChange={(event) => updateField("horarioFim", event.target.value)}
                required
              />
            </label>

            <fieldset className="md:col-span-2 space-y-2">
              <legend>Dias da semana</legend>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((day) => (
                  <label key={day.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.diasSemana.includes(day.value)}
                      onChange={() => toggleDay(day.value)}
                      aria-label={`Selecionar ${day.label}`}
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
              <p className="muted">Selecione os dias da semana em que as aulas ocorrerão.</p>
            </fieldset>

            <div className="md:col-span-2 flex items-center gap-3">
              <button className="btn" type="submit" disabled={saving || loading}>
                {saving ? "Salvando..." : selectedId ? "Salvar alterações" : "Cadastrar curso"}
              </button>
            </div>
          </form>

          {feedback && (
            <p className={`mt-4 ${feedback.ok ? "text-green-700" : "text-red-700"}`} role="alert">
              {feedback.message}
            </p>
          )}
        </section>
      )}

      {!isProfessorMode && (
        <section className="card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="mb-0">Cursos cadastrados</h2>
            <label className="flex items-center gap-2">
              <span>Filtrar por status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filtrar cursos por status"
              >
                <option value="">Todos os status</option>
                {COURSE_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <p className="muted mt-4">Carregando cursos…</p>
          ) : error ? (
            <p className="alert" role="alert">{error}</p>
          ) : filteredCourses.length === 0 ? (
            <p className="muted mt-4">Nenhum curso cadastrado.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th className="p-3">Curso</th>
                    <th className="p-3">Instituição</th>
                    <th className="p-3">Período</th>
                    <th className="p-3">Vagas / inscrições</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="border-b border-slate-200 align-top">
                      <td className="p-3">
                        <strong>{course.nome}</strong>
                        <div className="muted">
                          {course.cargaHoraria}h · {course.diasSemana?.length ? course.diasSemana.join(", ") : "Dias não informados"}
                        </div>
                      </td>
                      <td className="p-3">{course.instituicao ?? "Não informada"}</td>
                      <td className="p-3">{course.dataInicio || "-"} a {course.dataFim || "-"}</td>
                      <td className="p-3">
                        {course.vagas} vagas
                        <div className="muted">
                          {course.inscricoes === undefined ? "Inscrições não informadas" : `${course.inscricoes} inscrições`}
                        </div>
                      </td>
                      <td className="p-3">
                        {COURSE_STATUSES.find((status) => status.value === course.status?.toUpperCase())?.label ??
                          course.status ?? "Não informado"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {canManageStatus && course.status?.toUpperCase() === "ANALISE" && (
                            <button
                              className="btn btn-ghost"
                              type="button"
                              disabled={actionCourseId !== null}
                              onClick={() => void handleApprove(course)}
                            >
                              Aprovar
                            </button>
                          )}
                          <button className="btn btn-ghost" type="button" onClick={() => handleEdit(course)}>
                            Editar
                          </button>
                          {canManageStatus && (
                            <button
                              className="btn btn-ghost"
                              type="button"
                              disabled={actionCourseId !== null}
                              onClick={() => void handleDelete(course.id)}
                            >
                              {actionCourseId === course.id ? "Excluindo..." : "Excluir"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
