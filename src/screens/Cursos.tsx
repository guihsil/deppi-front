"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";

type Institution = {
  id: string;
  nome: string;
  cidade: string;
  campus: string;
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
};

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

function normalizeInstitution(value: unknown): Institution | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id ?? value.codigo ?? value.instituicaoId ?? value._id);
  const nome = readText(value.nome ?? value.nomeInstituicao ?? value.instituicaoNome);
  const cidade = readText(value.cidade ?? value.localidade ?? value.cidadeNome);
  const campus = readText(value.campus ?? value.nomeCampus ?? value.campusNome);
  if (!id || !nome || !cidade || !campus) return null;
  return { id, nome, cidade, campus };
}

function parseInstitutions(value: unknown): Institution[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.instituicoes)
      ? value.instituicoes
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : [];

  return rows.map((item) => normalizeInstitution(item)).filter((item): item is Institution => item !== null);
}

function normalizeCourse(value: unknown): Course | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id ?? value.codigo ?? value.cursoId);
  if (!id) return null;

  const hours = Number(readText(value.carga_horaria ?? value.cargaHoraria ?? value.cargaHorariaTotal ?? "0"));
  const vagas = Number(readText(value.vagas ?? value.vagasDisponiveis ?? value.quantidadeVagas ?? "0"));
  const dataInicio = readText(value.dataInicio ?? value.inicio ?? value.data_inicio);
  const dataFim = readText(value.dataFim ?? value.fim ?? value.data_fim);
  const horario = isRecord(value.horario) ? value.horario : undefined;
  const horarioInicio = readText(value.horarioInicio ?? value.horaInicio ?? (horario ? horario.inicio : undefined) ?? "");
  const horarioFim = readText(value.horarioFim ?? value.horaFim ?? (horario ? horario.fim : undefined) ?? "");
  const fkInstituicao = readText(value.fkInstituicao ?? value.instituicaoId ?? value.idInstituicao ?? "");

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
    instituicao: readText(value.instituicao ?? value.nomeInstituicao ?? value.instituicaoNome),
    status: readText(value.status ?? value.situacao ?? value.estado),
    diasSemana: Array.isArray(value.diasSemana) ? value.diasSemana.map((day) => String(day)) : [],
  };
}

function parseCourses(value: unknown): Course[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.cursos)
      ? value.cursos
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : [];

  return rows.map((item) => normalizeCourse(item)).filter((item): item is Course => item !== null);
}

export default function CursosScreen() {
  const { token } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function loadData() {
    if (!token) {
      setError("Sua sessão não está disponível. Entre novamente.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [institutionsResponse, coursesResponse] = await Promise.all([
        api<unknown>("/instituicao", { token }),
        api<unknown>("/cursos", { token }),
      ]);
      setInstitutions(parseInstitutions(institutionsResponse));
      setCourses(parseCourses(coursesResponse));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar as instituições e cursos.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedId) ?? null,
    [courses, selectedId],
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
    try {
      if (selectedId) {
        await api<unknown>(`/cursos/${encodeURIComponent(selectedId)}`, {
          method: "PUT",
          token,
          body: { ...body, id: selectedId },
        });
        setFeedback({ message: "Curso atualizado com sucesso.", ok: true });
      } else {
        await api<unknown>("/cursos", {
          method: "POST",
          token,
          body,
        });
        setFeedback({
          message: "Curso enviado para análise. O curso foi cadastrado como Em análise.",
          ok: true,
        });
      }

      resetForm();
      await loadData();
    } catch (submitError) {
      const message =
        submitError instanceof ApiError ? submitError.message : "Não foi possível salvar o curso.";
      setFeedback({ message, ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    const course = courses.find((item) => item.id === id);
    const confirmed = window.confirm(
      course ? `Deseja excluir o curso ${course.nome}?` : "Deseja excluir este curso?",
    );

    if (!confirmed) return;

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
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-head">
        <div>
          <h1 className="page-title">Cadastro e edição de curso</h1>
          <p className="muted">Valide regras de negócio, carregue instituições e mantenha o cadastro consistente.</p>
        </div>
      </header>

      <section className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2>{selectedId ? "Editar curso" : "Novo curso"}</h2>
          {selectedId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Limpar formulário
            </button>
          )}
        </div>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
          <label className="space-y-1 md:col-span-2">
            <span>Nome do curso</span>
            <input
              value={form.nome}
              onChange={(event) => updateField("nome", event.target.value)}
              placeholder="Ex.: Programação para web"
            />
          </label>

          <label className="space-y-1">
            <span>Instituição</span>
            <select value={form.fkInstituicao} onChange={(event) => updateField("fkInstituicao", event.target.value)}>
              <option value="">Selecione uma instituição</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.nome} · {institution.campus}
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
            />
          </label>

          <label className="space-y-1">
            <span>Vagas</span>
            <input
              type="number"
              min="1"
              value={form.vagas}
              onChange={(event) => updateField("vagas", event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span>Data início</span>
            <input
              type="date"
              value={form.dataInicio}
              onChange={(event) => updateField("dataInicio", event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span>Data fim</span>
            <input
              type="date"
              value={form.dataFim}
              onChange={(event) => updateField("dataFim", event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span>Horário início</span>
            <input
              type="time"
              value={form.horarioInicio}
              onChange={(event) => updateField("horarioInicio", event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span>Horário fim</span>
            <input
              type="time"
              value={form.horarioFim}
              onChange={(event) => updateField("horarioFim", event.target.value)}
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
            <p className="muted">A seleção de dias fica preparada na interface e será ativada quando o backend permitir gravação.</p>
          </fieldset>

          <div className="md:col-span-2 flex items-center gap-3">
            <button className="btn" type="submit" disabled={saving}>
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

      <section className="card">
        <h2>Cursos cadastrados</h2>

        {loading ? (
          <p className="muted mt-4">Carregando cursos…</p>
        ) : error ? (
          <p className="alert" role="alert">{error}</p>
        ) : courses.length === 0 ? (
          <p className="muted mt-4">Nenhum curso cadastrado.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {courses.map((course) => (
              <article key={course.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{course.nome}</h3>
                    <p className="muted">
                      {course.instituicao ?? "Instituição não informada"} · {course.diasSemana?.length ? course.diasSemana.join(", ") : "Sem dias definidos"}
                    </p>
                    <p className="muted">
                      {course.cargaHoraria}h · {course.vagas} vagas · {course.dataInicio || "-"} até {course.dataFim || "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                      {course.status ? course.status : "Em análise"}
                    </span>
                    <button className="btn btn-ghost" type="button" onClick={() => handleEdit(course)}>
                      Editar
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => void handleDelete(course.id)}>
                      Excluir
                    </button>
                  </div>
                </div>
                {course.status && course.status.toLowerCase().includes("anal") && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    Curso em análise. Após aprovação da equipe DEPPI, ele será liberado para andamento.
                  </p>
                )}
                {selectedCourse && selectedCourse.id === course.id && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <p><strong>Horário:</strong> {course.horarioInicio || "-"} até {course.horarioFim || "-"}</p>
                    <p><strong>Instituição ID:</strong> {course.fkInstituicao || "Não informado"}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
