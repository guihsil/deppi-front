"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { maskCNPJ } from "../lib/masks";

type Institution = {
  id: string;
  nome: string;
  cidade: string;
  campus: string;
  cnpj: string;
};

type FormState = {
  nome: string;
  cidade: string;
  campus: string;
  cnpj: string;
};

const emptyForm: FormState = {
  nome: "",
  cidade: "",
  campus: "",
  cnpj: "",
};

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
  const nome = readText(value.nome ?? value.nomeInstituicao ?? value.titulo);
  const cidade = readText(value.cidade ?? value.localidade ?? value.cidadeNome);
  const campus = readText(value.campus ?? value.nomeCampus ?? value.unidade);
  const cnpj = readText(value.cnpj ?? value.CNPJ ?? value.cnpjFormatado);

  if (!id || !nome || !cidade || !campus || !cnpj) return null;

  return {
    id,
    nome,
    cidade,
    campus,
    cnpj: cnpj.length > 18 ? cnpj.slice(0, 18) : cnpj,
  };
}

function parseInstitutions(value: unknown): Institution[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.instituicoes)
      ? value.instituicoes
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : [];

  const items = rows
    .map((item) => normalizeInstitution(item))
    .filter((item): item is Institution => item !== null);

  return items;
}

export default function InstituicoesScreen() {
  const { token } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);

  async function loadInstitutions() {
    if (!token) {
      setError("Sua sessão não está disponível. Entre novamente.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api<unknown>("/instituicao", { token });
      setInstitutions(parseInstitutions(response));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar as instituições.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInstitutions();
  }, [token]);

  const filteredInstitutions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return institutions;

    return institutions.filter((institution) =>
      [institution.nome, institution.cidade, institution.campus, institution.cnpj]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [institutions, search]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFeedback(null);
  }

  function handleInput(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: field === "cnpj" ? maskCNPJ(value) : value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const nome = form.nome.trim();
    const cidade = form.cidade.trim();
    const campus = form.campus.trim();
    const cnpj = form.cnpj.replace(/\D/g, "");

    if (!nome || !cidade || !campus || !cnpj) {
      setFeedback({ message: "Preencha nome, cidade, campus e CNPJ.", ok: false });
      return;
    }

    if (cnpj.length !== 14) {
      setFeedback({ message: "O CNPJ deve conter 14 dígitos.", ok: false });
      return;
    }

    const body = { nome, cidade, campus, cnpj };
    setSaving(true);
    setFeedback(null);

    try {
      if (editingId) {
        await api<unknown>("/instituicao/atualizar", {
          method: "PUT",
          token,
          body: { ...body, id: editingId },
        });
        setFeedback({ message: "Instituição atualizada com sucesso.", ok: true });
      } else {
        await api<unknown>("/instituicao/cadastrar", {
          method: "POST",
          token,
          body,
        });
        setFeedback({ message: "Instituição cadastrada com sucesso.", ok: true });
      }

      resetForm();
      await loadInstitutions();
    } catch (submitError) {
      const message =
        submitError instanceof ApiError
          ? submitError.message
          : "Não foi possível salvar a instituição.";
      setFeedback({ message, ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(institution: Institution) {
    setEditingId(institution.id);
    setForm({
      nome: institution.nome,
      cidade: institution.cidade,
      campus: institution.campus,
      cnpj: maskCNPJ(institution.cnpj),
    });
    setFeedback(null);
  }

  async function handleDelete(id: string) {
    if (!token) return;

    const institution = institutions.find((item) => item.id === id);
    const confirmed = window.confirm(
      institution
        ? `Deseja excluir a instituição ${institution.nome}?`
        : "Deseja excluir esta instituição?",
    );

    if (!confirmed) return;

    try {
      await api<unknown>("/instituicao/excluir", {
        method: "DELETE",
        token,
        body: { id },
      });
      setFeedback({ message: "Instituição excluída com sucesso.", ok: true });
      setForm(emptyForm);
      setEditingId(null);
      await loadInstitutions();
    } catch (deleteError) {
      const message =
        deleteError instanceof ApiError
          ? deleteError.message
          : "Não foi possível excluir a instituição.";
      setFeedback({ message, ok: false });
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-head">
        <div>
          <h1 className="page-title">Instituições</h1>
          <p className="muted">Cadastro, edição e remoção de instituições vinculadas ao DEPPI.</p>
        </div>
      </header>

      <section className="card">
        <h2>{editingId ? "Editar instituição" : "Nova instituição"}</h2>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
          <label className="space-y-1">
            <span>Nome</span>
            <input
              value={form.nome}
              onChange={(event) => handleInput("nome", event.target.value)}
              placeholder="Ex.: Instituto Federal do Ceará"
            />
          </label>

          <label className="space-y-1">
            <span>Cidade</span>
            <input
              value={form.cidade}
              onChange={(event) => handleInput("cidade", event.target.value)}
              placeholder="Ex.: Fortaleza"
            />
          </label>

          <label className="space-y-1">
            <span>Campus</span>
            <input
              value={form.campus}
              onChange={(event) => handleInput("campus", event.target.value)}
              placeholder="Ex.: Campus de Fortaleza"
            />
          </label>

          <label className="space-y-1">
            <span>CNPJ</span>
            <input
              value={form.cnpj}
              maxLength={18}
              onChange={(event) => handleInput("cnpj", event.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar instituição"}
            </button>
            {editingId && (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Cancelar
              </button>
            )}
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
          <h2>Instituições cadastradas</h2>
          <label className="min-w-[220px]">
            <span className="sr-only">Buscar instituição</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, cidade ou campus"
            />
          </label>
        </div>

        {loading ? (
          <p className="muted mt-4">Carregando instituições…</p>
        ) : error ? (
          <p className="alert" role="alert">{error}</p>
        ) : filteredInstitutions.length === 0 ? (
          <p className="muted mt-4">Nenhuma instituição encontrada.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 pr-3 font-semibold">Nome</th>
                  <th className="pb-3 pr-3 font-semibold">Cidade</th>
                  <th className="pb-3 pr-3 font-semibold">Campus</th>
                  <th className="pb-3 pr-3 font-semibold">CNPJ</th>
                  <th className="pb-3 pr-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstitutions.map((institution) => (
                  <tr key={institution.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-3">{institution.nome}</td>
                    <td className="py-3 pr-3">{institution.cidade}</td>
                    <td className="py-3 pr-3">{institution.campus}</td>
                    <td className="py-3 pr-3">{maskCNPJ(institution.cnpj)}</td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-ghost" type="button" onClick={() => handleEdit(institution)}>
                          Editar
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => void handleDelete(institution.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
