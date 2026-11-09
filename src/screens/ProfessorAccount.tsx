"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { isValidEmail, maskPhone } from "../lib/masks";

const EMAIL_FIELDS = [
  { key: "emailInstitucional", label: "E-mail institucional", autoComplete: "email", required: true },
  { key: "emailSecundario", label: "E-mail secundário", autoComplete: "email", required: true },
  { key: "emailSiape", label: "E-mail SIAPE", autoComplete: "off", required: false },
  { key: "emailNotificacoes", label: "E-mail para notificações", autoComplete: "off", required: false },
  { key: "emailClassroom", label: "E-mail Classroom", autoComplete: "off", required: false },
] as const;

type EmailKey = (typeof EMAIL_FIELDS)[number]["key"];
type FormErrors = Partial<Record<EmailKey | "nomeUsual" | "emPGD", string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(maskPhone)
    : [];
}

function PhoneList({
  legend,
  phones,
  onChange,
}: {
  legend: string;
  phones: string[];
  onChange: (phones: string[]) => void;
}) {
  return (
    <fieldset className="phone-list">
      <legend>{legend}</legend>
      {phones.map((phone, index) => (
        <div className="phone-row" key={index}>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(85) 99999-9999"
            aria-label={`${legend} ${index + 1}`}
            value={phone}
            onChange={(event) =>
              onChange(phones.map((item, i) => (i === index ? maskPhone(event.target.value) : item)))
            }
          />
          <button
            className="btn btn-ghost"
            type="button"
            aria-label={`Remover ${legend.toLowerCase()} ${index + 1}`}
            onClick={() => onChange(phones.filter((_, i) => i !== index))}
          >
            Remover
          </button>
        </div>
      ))}
      <div>
        <button className="btn btn-ghost" type="button" onClick={() => onChange([...phones, ""])}>
          + Adicionar telefone
        </button>
      </div>
    </fieldset>
  );
}

export default function ProfessorAccount() {
  const { token } = useAuth();
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [nomeUsual, setNomeUsual] = useState("");
  const [emails, setEmails] = useState<Record<EmailKey, string>>({
    emailInstitucional: "",
    emailSecundario: "",
    emailSiape: "",
    emailNotificacoes: "",
    emailClassroom: "",
  });
  const [telInstitucionais, setTelInstitucionais] = useState<string[]>([]);
  const [telPessoais, setTelPessoais] = useState<string[]>([]);
  const [emPGD, setEmPGD] = useState<boolean | null>(null);

  // O id do professor vem do perfil do usuário autenticado (/users/me).
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      if (!token) {
        setLoadError("Sua sessão não está disponível. Entre novamente.");
        setLoading(false);
        return;
      }
      try {
        const response = await api<unknown>("/users/me", { token });
        const user = isRecord(response) && isRecord(response.usuario) ? response.usuario : response;
        if (!isRecord(user)) throw new ApiError("A resposta do perfil é inválida.", 502);
        // /users/me inclui o cadastro de professor; a rota de conta usa o id dele (não o do usuário).
        const professor = isRecord(user.professor) ? user.professor : null;
        if (!professor || (typeof professor.id !== "string" && typeof professor.id !== "number")) {
          throw new ApiError("Não foi possível identificar o seu cadastro de professor.", 404);
        }
        if (!active) return;
        setProfessorId(String(professor.id));
        // O backend grava "nomeUsual" no campo nomeSocial do usuário.
        setNomeUsual(text(user.nomeSocial));
        setEmails({
          emailInstitucional: text(user.emailInstitucional) || text(user.email),
          emailSecundario: text(user.emailSecundario),
          emailSiape: text(professor.emailSiape),
          emailNotificacoes: text(professor.emailNotificacoes),
          emailClassroom: text(professor.emailClassroom),
        });
        setTelInstitucionais(textList(professor.telefonesInstitucionais));
        setTelPessoais(textList(professor.telefonesPessoais));
        setEmPGD(typeof professor.emPGD === "boolean" ? professor.emPGD : null);
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Não foi possível carregar seus dados.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token, retry]);

  function clearFeedback() {
    setFeedback(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !professorId) return;

    const found: FormErrors = {};
    if (nomeUsual.trim().length < 3) found.nomeUsual = "O nome usual deve ter no mínimo 3 caracteres.";
    for (const { key, label, required } of EMAIL_FIELDS) {
      const value = emails[key].trim();
      if (!value && required) found[key] = `${label} é obrigatório.`;
      else if (value && !isValidEmail(value)) found[key] = `${label} inválido.`;
    }
    if (emPGD === null) found.emPGD = "Informe se você está em PGD.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFeedback({ message: "Corrija os campos destacados.", isError: true });
      return;
    }

    // Opcionais vazios são omitidos: o backend aceita "", mas emailSiape é único no banco.
    const body: Record<string, unknown> = {
      nomeUsual: nomeUsual.trim(),
      telefonesInstitucionais: telInstitucionais.map((t) => t.trim()).filter(Boolean),
      telefonesPessoais: telPessoais.map((t) => t.trim()).filter(Boolean),
      emPGD,
    };
    for (const { key } of EMAIL_FIELDS) {
      const value = emails[key].trim();
      if (value) body[key] = value;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await api<unknown>(`/professores/${encodeURIComponent(professorId)}/conta`, {
        method: "PUT",
        token,
        body,
      });
      setFeedback({ message: "Dados da conta salvos com sucesso.", isError: false });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors.length > 0) {
          const apiErrors: FormErrors = {};
          for (const { campo, mensagem } of error.fieldErrors) {
            if (campo === "nomeUsual" || campo === "emPGD" || EMAIL_FIELDS.some((f) => f.key === campo)) {
              apiErrors[campo as keyof FormErrors] = mensagem;
            }
          }
          setErrors(apiErrors);
        }
        setFeedback({
          message:
            error.status === 403
              ? "Sem permissão para salvar: hoje esta rota exige permissão da equipe DEPPI. Peça o ajuste ao backend."
              : error.message,
          isError: true,
        });
      } else {
        setFeedback({ message: "Não foi possível salvar os dados.", isError: true });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="center-msg" role="status">Carregando…</p>;

  if (loadError) {
    return (
      <section className="card profile-page">
        <h1>Minha conta</h1>
        <p className="profile-feedback error" role="alert">{loadError}</p>
        <div className="profile-actions">
          <button className="btn" type="button" onClick={() => setRetry((v) => v + 1)}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <h1>Minha conta</h1>
          <p className="muted">Mantenha seus e-mails, telefones e situação de PGD atualizados.</p>
        </div>
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
        <section aria-labelledby="conta-dados">
          <h2 className="profile-section-title" id="conta-dados">Dados e e-mails</h2>
          <div className="profile-grid">
            <label>
              Nome usual
              <input
                autoComplete="nickname"
                value={nomeUsual}
                aria-invalid={errors.nomeUsual ? true : undefined}
                onChange={(event) => {
                  setNomeUsual(event.target.value);
                  clearFeedback();
                }}
              />
              {errors.nomeUsual && <span className="field-error">{errors.nomeUsual}</span>}
            </label>
            {EMAIL_FIELDS.map(({ key, label, autoComplete, required }) => (
              <label key={key}>
                {label}{required ? "" : " (opcional)"}
                <input
                  type="email"
                  autoComplete={autoComplete}
                  value={emails[key]}
                  aria-invalid={errors[key] ? true : undefined}
                  onChange={(event) => {
                    setEmails((current) => ({ ...current, [key]: event.target.value }));
                    setErrors((current) => ({ ...current, [key]: undefined }));
                    clearFeedback();
                  }}
                />
                {errors[key] && <span className="field-error">{errors[key]}</span>}
              </label>
            ))}
          </div>
        </section>

        <section aria-labelledby="conta-telefones">
          <h2 className="profile-section-title" id="conta-telefones">Telefones</h2>
          <div className="profile-grid">
            <PhoneList
              legend="Telefone institucional"
              phones={telInstitucionais}
              onChange={(list) => {
                setTelInstitucionais(list);
                clearFeedback();
              }}
            />
            <PhoneList
              legend="Telefone pessoal"
              phones={telPessoais}
              onChange={(list) => {
                setTelPessoais(list);
                clearFeedback();
              }}
            />
          </div>
        </section>

        <section aria-labelledby="conta-pgd">
          <h2 className="profile-section-title" id="conta-pgd">Programa de Gestão e Desempenho</h2>
          <fieldset className="pgd" aria-invalid={errors.emPGD ? true : undefined}>
            <legend>Você está em PGD? (obrigatório)</legend>
            <label className="check">
              <input
                type="radio"
                name="emPGD"
                checked={emPGD === true}
                onChange={() => {
                  setEmPGD(true);
                  setErrors((current) => ({ ...current, emPGD: undefined }));
                  clearFeedback();
                }}
              />
              Sim
            </label>
            <label className="check">
              <input
                type="radio"
                name="emPGD"
                checked={emPGD === false}
                onChange={() => {
                  setEmPGD(false);
                  setErrors((current) => ({ ...current, emPGD: undefined }));
                  clearFeedback();
                }}
              />
              Não
            </label>
            {errors.emPGD && <span className="field-error">{errors.emPGD}</span>}
          </fieldset>
        </section>

        <div className="profile-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar dados"}
          </button>
        </div>
      </form>
    </div>
  );
}
