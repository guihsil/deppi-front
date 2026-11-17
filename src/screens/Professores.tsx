"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { isValidEmail, maskPhone } from "../lib/masks";

type Professor = {
  id: string;
  siape: string;
  nome: string;
  emailSiape?: string;
  email?: string;
  titulacao?: string;
  escolaridade?: string;
  emPGD?: boolean;
  fkUsuario?: string | number;
  telefones?: string[];
  telefonesInstitucionais?: string[];
  telefonesPessoais?: string[];
  alocacoes?: Array<{ curso?: string; nome?: string; periodo?: string; status?: string }>;
};

type FormState = {
  siape: string;
  fkUsuario: string;
  emailSiape: string;
  telefonesInstitucionais: string[];
  telefonesPessoais: string[];
  emPGD: boolean | null;
  titulacao: string;
  escolaridade: string;
};

const emptyForm: FormState = {
  siape: "",
  fkUsuario: "",
  emailSiape: "",
  telefonesInstitucionais: [""],
  telefonesPessoais: [""],
  emPGD: null,
  titulacao: "",
  escolaridade: "",
};

type UserOption = {
  id: string | number;
  nome?: string;
  email?: string;
  matricula?: string;
};

type ProfessorPayload = {
  siape: string;
  fkUsuario: string;
  emailSiape: string | null;
  telefonesInstitucionais: string[];
  telefonesPessoais: string[];
  emPGD: boolean | null;
  titulacao: string | null;
  escolaridade: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readId(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function normalizePhones(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? maskPhone(item) : typeof item === "number" ? maskPhone(String(item)) : ""))
    .filter((item) => item.length > 0);
}

function normalizeProfessor(value: unknown): Professor | null {
  if (!isRecord(value)) return null;

  const usuario = isRecord(value.usuario) ? value.usuario : undefined;
  const id = readId(value.id ?? value.codigo ?? value.professorId);
  if (!id) return null;

  const nome = readText(value.nome ?? value.nomeUsuario ?? (usuario ? usuario.nome : undefined) ?? value.usuarioNome);
  const siape = readText(value.siape ?? value.siapeProfessor);
  const emailSiape = readText(value.emailSiape ?? value.email_siape);
  const email = readText(value.email ?? value.emailInstitucional ?? (usuario ? usuario.emailInstitucional : undefined) ?? value.emailPrincipal);
  const titulacao = readText(value.titulacao ?? value.titulacaoAcademica);
  const escolaridade = readText(value.escolaridade ?? value.formacao);
  const emPGD = typeof value.emPGD === "boolean" ? value.emPGD : undefined;
  const fkUsuario = readId(value.fkUsuario ?? value.usuarioId ?? (usuario ? usuario.id : undefined));
  const telefonesInstitucionais = normalizePhones(value.telefonesInstitucionais ?? value.telefones);
  const telefonesPessoais = normalizePhones(value.telefonesPessoais);
  const alocacoes = Array.isArray(value.alocacoes) || Array.isArray(value.cursos)
    ? (Array.isArray(value.alocacoes) ? value.alocacoes : value.cursos)
    : [];

  return {
    id,
    siape: siape || "",
    nome: nome || email || "Professor",
    emailSiape: emailSiape || undefined,
    email: email || undefined,
    titulacao: titulacao || undefined,
    escolaridade: escolaridade || undefined,
    emPGD,
    fkUsuario: fkUsuario || undefined,
    telefones: [...telefonesInstitucionais, ...telefonesPessoais],
    telefonesInstitucionais,
    telefonesPessoais,
    alocacoes: Array.isArray(alocacoes) ? alocacoes.map((item) => (isRecord(item) ? item : {})) : [],
  };
}

function parseProfessors(value: unknown): Professor[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.professores)
      ? value.professores
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : [];

  return rows.map((item) => normalizeProfessor(item)).filter((item): item is Professor => item !== null);
}

function normalizeUserOptions(value: unknown): UserOption[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.usuarios)
      ? value.usuarios
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : [];

  return rows.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = readId(item.id ?? item.usuarioId ?? item.codigo);
    if (!id) return [];
    return [{
      id,
      nome: readText(item.nome ?? item.nomeCompleto ?? item.usuarioNome),
      email: readText(item.email ?? item.emailInstitucional ?? item.emailPrincipal),
      matricula: readText(item.matricula ?? item.siape),
    }];
  });
}

function confirmsProfessorRole(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const professor = isRecord(value.professor) ? value.professor : value;
  const usuario = isRecord(professor.usuario)
    ? professor.usuario
    : isRecord(value.usuario)
      ? value.usuario
      : null;
  const cargos = usuario?.cargos ?? professor.cargos ?? value.cargos;
  return Array.isArray(cargos) && cargos.includes("PROFESSOR");
}

export default function ProfessoresScreen() {
  const { token } = useAuth();
  const submitting = useRef(false);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [userError, setUserError] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadData = useCallback(async (currentToken: string) => {
    const [professorResult, userResult] = await Promise.allSettled([
      api<unknown>("/professores", { token: currentToken }),
      api<unknown>("/users", { token: currentToken }),
    ]);
    setError("");
    setUserError("");
    if (professorResult.status === "fulfilled") {
      setProfessors(parseProfessors(professorResult.value));
    } else {
      setError(
        professorResult.reason instanceof Error
          ? professorResult.reason.message
          : "Não foi possível carregar os professores.",
      );
    }

    if (userResult.status === "fulfilled") {
      setUsers(normalizeUserOptions(userResult.value));
    } else {
      setUserError(
        userResult.reason instanceof Error
          ? userResult.reason.message
          : "Não foi possível carregar os usuários vinculáveis.",
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) return;

    let active = true;
    async function loadInitialData() {
      const [professorResult, userResult] = await Promise.allSettled([
        api<unknown>("/professores", { token }),
        api<unknown>("/users", { token }),
      ]);
      if (!active) return;

      setError("");
      setUserError("");
      if (professorResult.status === "fulfilled") {
        setProfessors(parseProfessors(professorResult.value));
      } else {
        setError(
          professorResult.reason instanceof Error
            ? professorResult.reason.message
            : "Não foi possível carregar os professores.",
        );
      }

      if (userResult.status === "fulfilled") {
        setUsers(normalizeUserOptions(userResult.value));
      } else {
        setUserError(
          userResult.reason instanceof Error
            ? userResult.reason.message
            : "Não foi possível carregar os usuários vinculáveis.",
        );
      }

      setLoading(false);
    }

    void loadInitialData();
    return () => {
      active = false;
    };
  }, [token]);

  const filteredProfessors = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return professors;

    return professors.filter((professor) =>
      [professor.nome, professor.siape, professor.email ?? "", professor.emailSiape ?? ""]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [professors, search]);

  const selectedProfessor = useMemo(
    () => professors.find((professor) => professor.id === selectedId) ?? null,
    [professors, selectedId],
  );

  const availableUsers = useMemo(() => {
    const linkedUserIds = new Set(
      professors
        .filter((professor) => professor.id !== selectedId)
        .map((professor) => String(professor.fkUsuario ?? ""))
        .filter(Boolean),
    );
    return users.filter((user) => !linkedUserIds.has(String(user.id)));
  }, [professors, selectedId, users]);

  function resetForm() {
    setSelectedId(null);
    setForm(emptyForm);
    setFeedback(null);
    setFieldErrors({});
  }

  function updateField(field: keyof FormState, value: string | boolean | null) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handlePhones(field: "telefonesInstitucionais" | "telefonesPessoais", nextPhones: string[]) {
    setForm((current) => ({ ...current, [field]: nextPhones }));
  }

  function handleEdit(professor: Professor) {
    setSelectedId(professor.id);
    setForm({
      siape: professor.siape,
      fkUsuario: String(professor.fkUsuario ?? ""),
      emailSiape: professor.emailSiape ?? "",
      telefonesInstitucionais:
        professor.telefonesInstitucionais?.length
          ? professor.telefonesInstitucionais
          : professor.telefones ?? [""],
      telefonesPessoais: professor.telefonesPessoais?.length
        ? professor.telefonesPessoais
        : [""],
      emPGD: professor.emPGD ?? null,
      titulacao: professor.titulacao ?? "",
      escolaridade: professor.escolaridade ?? "",
    });
    setFeedback(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting.current) return;

    const siape = form.siape.trim();
    const fkUsuario = String(form.fkUsuario).trim();
    const emailSiape = form.emailSiape.trim();
    const telefonesInstitucionais = form.telefonesInstitucionais.map((value) => value.trim()).filter(Boolean);
    const telefonesPessoais = form.telefonesPessoais.map((value) => value.trim()).filter(Boolean);

    if (!siape || !fkUsuario) {
      setFeedback({ message: "SIAPE e usuário vinculados são obrigatórios.", ok: false });
      return;
    }

    if (emailSiape && !isValidEmail(emailSiape)) {
      setFeedback({ message: "Informe um e-mail SIAPE válido.", ok: false });
      setFieldErrors({ emailSiape: "E-mail SIAPE inválido." });
      return;
    }

    const createBody: ProfessorPayload = {
      siape,
      fkUsuario,
      emailSiape: emailSiape || null,
      telefonesInstitucionais,
      telefonesPessoais,
      emPGD: form.emPGD,
      titulacao: form.titulacao.trim() || null,
      escolaridade: form.escolaridade.trim() || null,
    };

    const updateBody = {
      ...createBody,
      emailSiape: emailSiape || undefined,
      titulacao: form.titulacao.trim() || undefined,
      escolaridade: form.escolaridade.trim() || undefined,
    };

    submitting.current = true;
    setSaving(true);
    setFeedback(null);
    setFieldErrors({});
    let successMessage: string;
    try {
      if (selectedId) {
        await api<unknown>(`/professores/${encodeURIComponent(selectedId)}`, {
          method: "PUT",
          token,
          body: { ...updateBody, id: selectedId },
        });
        successMessage = "Professor atualizado com sucesso.";
      } else {
        const response = await api<unknown>("/professores", {
          method: "POST",
          token,
          body: createBody,
        });
        successMessage = confirmsProfessorRole(response)
          ? "Professor cadastrado e cargo PROFESSOR confirmado pela API."
          : "Professor cadastrado. A resposta da API não confirmou se o usuário vinculado recebeu o cargo PROFESSOR.";
      }

      resetForm();
      setFeedback({ message: successMessage, ok: true });
      if (token) await loadData(token);
    } catch (submitError) {
      const message =
        submitError instanceof ApiError
          ? submitError.status === 403
            ? "Sua sessão não tem a permissão necessária para cadastrar ou gerenciar professores."
            : submitError.status === 409
              ? "Já existe um professor com algum dado informado, como SIAPE ou e-mail SIAPE."
              : submitError.message
          : "Não foi possível salvar o professor.";
      if (submitError instanceof ApiError && submitError.fieldErrors.length > 0) {
        setFieldErrors(
          Object.fromEntries(
            submitError.fieldErrors.map(({ campo, mensagem }) => [campo, mensagem]),
          ),
        );
      }
      setFeedback({ message, ok: false });
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;

    const professor = professors.find((item) => item.id === id);
    const confirmed = window.confirm(
      professor ? `Deseja excluir o professor ${professor.nome}?` : "Deseja excluir este professor?",
    );

    if (!confirmed) return;

    try {
      await api<unknown>(`/professores/${encodeURIComponent(id)}`, {
        method: "DELETE",
        token,
      });
      setFeedback({ message: "Professor excluído com sucesso.", ok: true });
      resetForm();
      if (token) await loadData(token);
    } catch (deleteError) {
      const message =
        deleteError instanceof ApiError ? deleteError.message : "Não foi possível excluir o professor.";
      setFeedback({ message, ok: false });
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-head">
        <div>
          <h1 className="page-title">Gestão de professores</h1>
          <p className="muted">Cadastre, edite e consulte professores com vínculo e alocações.</p>
        </div>
      </header>

      <section className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2>{selectedId ? "Editar professor" : "Novo professor"}</h2>
          {selectedId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Limpar formulário
            </button>
          )}
        </div>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
          <label className="space-y-1">
            <span>SIAPE</span>
            <input
              value={form.siape}
              onChange={(event) => updateField("siape", event.target.value)}
              placeholder="123456"
              aria-invalid={Boolean(fieldErrors.siape)}
            />
            {fieldErrors.siape && <span className="field-error" role="alert">{fieldErrors.siape}</span>}
          </label>

          <label className="space-y-1">
            <span>Usuário vinculado</span>
            <select
              value={form.fkUsuario}
              onChange={(event) => updateField("fkUsuario", event.target.value)}
              aria-invalid={Boolean(fieldErrors.fkUsuario)}
            >
              <option value="">Selecione um usuário</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {[user.nome, user.email, user.matricula ? `Matrícula ${user.matricula}` : ""]
                    .filter(Boolean)
                    .join(" · ") || `Usuário ${user.id}`}
                </option>
              ))}
            </select>
            {fieldErrors.fkUsuario && <span className="field-error" role="alert">{fieldErrors.fkUsuario}</span>}
            {!userError && users.length > 0 && availableUsers.length === 0 && (
              <span className="muted small">Todos os usuários carregados já possuem cadastro de professor.</span>
            )}
            {userError && <span className="field-error" role="alert">{userError}</span>}
          </label>

          <label className="space-y-1">
            <span>E-mail SIAPE</span>
            <input
              value={form.emailSiape}
              onChange={(event) => updateField("emailSiape", event.target.value)}
              placeholder="nome@siape.gov.br"
              aria-invalid={Boolean(fieldErrors.emailSiape)}
            />
            {fieldErrors.emailSiape && <span className="field-error" role="alert">{fieldErrors.emailSiape}</span>}
          </label>

          <label className="space-y-1">
            <span>Titulação</span>
            <input
              value={form.titulacao}
              onChange={(event) => updateField("titulacao", event.target.value)}
              placeholder="Doutor, Mestre, Especialista..."
              aria-invalid={Boolean(fieldErrors.titulacao)}
            />
            {fieldErrors.titulacao && <span className="field-error" role="alert">{fieldErrors.titulacao}</span>}
          </label>

          <label className="space-y-1 md:col-span-2">
            <span>Escolaridade</span>
            <input
              value={form.escolaridade}
              onChange={(event) => updateField("escolaridade", event.target.value)}
              placeholder="Graduação, Pós-graduação, Mestrado..."
              aria-invalid={Boolean(fieldErrors.escolaridade)}
            />
            {fieldErrors.escolaridade && <span className="field-error" role="alert">{fieldErrors.escolaridade}</span>}
          </label>

          <fieldset className="md:col-span-2 space-y-2">
            <legend>Telefones institucionais</legend>
            {form.telefonesInstitucionais.map((phone, index) => (
              <div className="flex gap-2" key={index}>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => {
                    const nextPhones = [...form.telefonesInstitucionais];
                    nextPhones[index] = maskPhone(event.target.value);
                    handlePhones("telefonesInstitucionais", nextPhones);
                  }}
                  placeholder="(85) 99999-9999"
                  aria-label={`Telefone institucional ${index + 1}`}
                />
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() =>
                    handlePhones(
                      "telefonesInstitucionais",
                      form.telefonesInstitucionais.filter((_, position) => position !== index),
                    )
                  }
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => handlePhones("telefonesInstitucionais", [...form.telefonesInstitucionais, ""])}
            >
              + Adicionar telefone institucional
            </button>
          </fieldset>

          <fieldset className="md:col-span-2 space-y-2">
            <legend>Telefones pessoais</legend>
            {form.telefonesPessoais.map((phone, index) => (
              <div className="flex gap-2" key={index}>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => {
                    const nextPhones = [...form.telefonesPessoais];
                    nextPhones[index] = maskPhone(event.target.value);
                    handlePhones("telefonesPessoais", nextPhones);
                  }}
                  placeholder="(85) 99999-9999"
                  aria-label={`Telefone pessoal ${index + 1}`}
                />
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() =>
                    handlePhones(
                      "telefonesPessoais",
                      form.telefonesPessoais.filter((_, position) => position !== index),
                    )
                  }
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => handlePhones("telefonesPessoais", [...form.telefonesPessoais, ""])}
            >
              + Adicionar telefone pessoal
            </button>
          </fieldset>

          <fieldset className="md:col-span-2 space-y-2">
            <legend>PGD</legend>
            <div className="flex gap-4">
              <label>
                <input
                  type="radio"
                  name="emPGD"
                  checked={form.emPGD === true}
                  onChange={() => updateField("emPGD", true)}
                />
                <span>Sim</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="emPGD"
                  checked={form.emPGD === false}
                  onChange={() => updateField("emPGD", false)}
                />
                <span>Não</span>
              </label>
            </div>
          </fieldset>

          <div className="md:col-span-2 flex items-center gap-3">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Salvando..." : selectedId ? "Salvar alterações" : "Cadastrar professor"}
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2>Professores cadastrados</h2>
          <label className="min-w-[220px]">
            <span className="sr-only">Buscar professor</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, SIAPE ou e-mail"
            />
          </label>
        </div>

        {loading ? (
          <p className="muted mt-4">Carregando professores…</p>
        ) : error ? (
          <p className="alert" role="alert">{error}</p>
        ) : filteredProfessors.length === 0 ? (
          <p className="muted mt-4">Nenhum professor encontrado.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {filteredProfessors.map((professor) => (
              <article key={professor.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{professor.nome}</h3>
                    {professor.siape && <p className="muted">SIAPE: {professor.siape}</p>}
                    {professor.emailSiape && <p className="muted">E-mail SIAPE: {professor.emailSiape}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setSelectedId(professor.id)}
                    >
                      Detalhes
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => handleEdit(professor)}>
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => void handleDelete(professor.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {selectedProfessor && selectedProfessor.id === professor.id && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-4">
                    <p><strong>Usuário vinculado:</strong> {selectedProfessor.fkUsuario ?? "Não informado"}</p>
                    <p><strong>PGD:</strong> {selectedProfessor.emPGD === true ? "Sim" : selectedProfessor.emPGD === false ? "Não" : "Não informado"}</p>
                    <p><strong>Telefones institucionais:</strong> {selectedProfessor.telefonesInstitucionais?.join(", ") || "Nenhum"}</p>
                    <p><strong>Telefones pessoais:</strong> {selectedProfessor.telefonesPessoais?.join(", ") || "Nenhum"}</p>
                    <p><strong>Alocações em cursos:</strong> {selectedProfessor.alocacoes && selectedProfessor.alocacoes.length > 0 ? selectedProfessor.alocacoes.length : 0}</p>
                    {selectedProfessor.alocacoes && selectedProfessor.alocacoes.length > 0 ? (
                      <ul className="mt-2 list-disc pl-5">
                        {selectedProfessor.alocacoes.slice(0, 5).map((allocation, index) => (
                          <li key={`${allocation.curso ?? "a"}-${index}`}>
                            {allocation.curso ?? allocation.nome ?? "Curso"}
                            {allocation.periodo ? ` — ${allocation.periodo}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Sem alocações em cursos no momento.</p>
                    )}
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
