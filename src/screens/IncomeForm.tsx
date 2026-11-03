"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { digitsToCents, formatCurrency, maskCurrency } from "../lib/masks";

type Errors = { rendaFamiliar?: string; numeroPessoas?: string };

const FIELD_MAP: Record<string, keyof Errors> = {
  rendaFamiliar: "rendaFamiliar",
  numeroPessoas: "numeroPessoas",
};

export default function IncomeForm({ inscricaoId }: { inscricaoId: string }) {
  const { token } = useAuth();
  const [renda, setRenda] = useState("");
  const [pessoas, setPessoas] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const rendaValue = digitsToCents(renda) / 100;
  const pessoasValue = pessoas ? Number(pessoas) : 0;
  const perCapita = useMemo(
    () => (rendaValue > 0 && pessoasValue > 0 ? rendaValue / pessoasValue : null),
    [rendaValue, pessoasValue],
  );

  function validate(): Errors {
    const next: Errors = {};
    if (!(rendaValue > 0)) next.rendaFamiliar = "Informe um valor maior que zero.";
    if (!Number.isInteger(pessoasValue) || pessoasValue <= 0) {
      next.numeroPessoas = "Informe um número inteiro maior que zero.";
    }
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setFeedback({ message: "Sua sessão não está disponível. Entre novamente.", isError: true });
      return;
    }
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFeedback(null);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await api<unknown>(`/inscricoes/${encodeURIComponent(inscricaoId)}/renda`, {
        method: "POST",
        token,
        body: { rendaFamiliar: rendaValue, numeroPessoas: pessoasValue },
      });
      setFeedback({
        message: "Renda enviada com sucesso. Você pode reenviar para corrigir os valores.",
        isError: false,
      });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        const apiErrors: Errors = {};
        for (const { campo, mensagem } of error.fieldErrors) {
          const key = FIELD_MAP[campo];
          if (key) apiErrors[key] = mensagem;
        }
        setErrors(apiErrors);
      }
      setFeedback({
        message: error instanceof Error ? error.message : "Não foi possível enviar a renda.",
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <h1>Renda familiar</h1>
          <p className="muted">
            Informe a renda bruta mensal da sua família e o número de pessoas que moram com você.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/aluno">Voltar</Link>
      </header>

      {feedback && (
        <p
          className={`profile-feedback${feedback.isError ? " error" : ""}`}
          role={feedback.isError ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}

      <form className="card profile-card" onSubmit={submit} noValidate>
        <div className="profile-grid">
          <label>
            Renda familiar mensal
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="R$ 0,00"
              value={maskCurrency(renda)}
              aria-invalid={errors.rendaFamiliar ? true : undefined}
              aria-describedby={errors.rendaFamiliar ? "renda-erro" : undefined}
              onChange={(event) => {
                setRenda(event.target.value);
                setErrors((current) => ({ ...current, rendaFamiliar: undefined }));
              }}
            />
            {errors.rendaFamiliar && (
              <span className="field-error" id="renda-erro">{errors.rendaFamiliar}</span>
            )}
          </label>
          <label>
            Número de pessoas na família
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex.: 4"
              value={pessoas}
              aria-invalid={errors.numeroPessoas ? true : undefined}
              aria-describedby={errors.numeroPessoas ? "pessoas-erro" : undefined}
              onChange={(event) => {
                setPessoas(event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 3));
                setErrors((current) => ({ ...current, numeroPessoas: undefined }));
              }}
            />
            {errors.numeroPessoas && (
              <span className="field-error" id="pessoas-erro">{errors.numeroPessoas}</span>
            )}
          </label>
        </div>

        <div className="percapita" aria-live="polite">
          <span className="profile-field-label">Renda per capita (cálculo apenas ilustrativo)</span>
          <strong>{perCapita === null ? "—" : formatCurrency(perCapita)}</strong>
        </div>

        <div className="profile-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Enviando…" : "Enviar renda"}
          </button>
        </div>
      </form>
    </div>
  );
}
