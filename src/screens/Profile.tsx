"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../roles";

type ProfileData = {
  nome: string;
  nomeSocial: string;
  cargos: string[];
  email?: string;
  emailSecundario?: string;
  dataNasc?: string;
  naturalidade?: string;
  nomeMae?: string;
  nomePai?: string;
  sexo?: string;
  raca?: string;
  matricula?: string;
  siape?: string;
  rg?: string;
  cpf?: string;
  orgaoEmissor?: string;
  estado?: string;
  dataEmissao?: string;
  tituloNumero?: string;
  zonaEleitoral?: string;
  secaoEleitoral?: string;
  ufTitulo?: string;
  endereco: Array<{ label: string; value: string }>;
};

type ProfileUpdate = {
  nome?: string;
  nomeSocial?: string;
  senha?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function parseProfile(value: unknown, fallbackCargos: Role[]): ProfileData {
  const user =
    isRecord(value) && isRecord(value.usuario) ? value.usuario : value;

  if (!isRecord(user)) {
    throw new ApiError("A resposta do perfil é inválida.", 502);
  }

  const cargos = Array.isArray(user.cargos)
    ? user.cargos.filter((cargo): cargo is string => typeof cargo === "string")
    : fallbackCargos;
  const endereco: ProfileData["endereco"] = [];

  if (isRecord(user.endereco)) {
    const addressFields = [
      ["rua", "Rua"],
      ["bairro", "Bairro"],
      ["numero", "Número"],
      ["cep", "CEP"],
      ["complemento", "Complemento"],
      ["cidade", "Cidade"],
      ["estado", "Estado"],
    ] as const;

    for (const [key, label] of addressFields) {
      const addressValue = readText(user.endereco[key]);
      if (addressValue) endereco.push({ label, value: addressValue });
    }
  } else {
    const addressValue = readText(user.endereco);
    if (addressValue) endereco.push({ label: "Endereço", value: addressValue });
  }

  return {
    nome: readText(user.nome) ?? "",
    nomeSocial: readText(user.nomeSocial) ?? "",
    cargos,
    email: readText(user.email),
    emailSecundario: readText(user.emailSecundario),
    dataNasc: readText(user.dataNasc),
    naturalidade: readText(user.naturalidade),
    nomeMae: readText(user.nomeMae),
    nomePai: readText(user.nomePai),
    sexo: readText(user.sexo),
    raca: readText(user.raca),
    matricula: readText(user.matricula),
    siape: readText(user.siape),
    rg: readText(user.rg),
    cpf: readText(user.cpf),
    orgaoEmissor: readText(user.orgaoEmissor),
    estado: readText(user.estado),
    dataEmissao: readText(user.dataEmissao),
    tituloNumero: readText(user.tituloNumero),
    zonaEleitoral: readText(user.zonaEleitoral),
    secaoEleitoral: readText(user.secaoEleitoral),
    ufTitulo: readText(user.ufTitulo),
    endereco,
  };
}

function hasCargo(cargos: string[], role: Role): boolean {
  return cargos.some((cargo) => cargo.trim().toUpperCase() === role);
}

function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function ProfileField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="profile-field">
      <span className="profile-field-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function Profile() {
  const { token, cargos: sessionCargos, updateUserName } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [nome, setNome] = useState("");
  const [nomeSocial, setNomeSocial] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setLoadError("");
      if (!token) {
        setLoadError("Sua sessão não está disponível. Entre novamente.");
        setLoading(false);
        return;
      }

      try {
        const response = await api<unknown>("/users/me", { token });
        const data = parseProfile(response, sessionCargos);
        if (!active) return;
        setProfile(data);
        setNome(data.nome);
        setNomeSocial(data.nomeSocial);
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível carregar seu perfil.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [token, retry, sessionCargos]);

  function clearPasswordFields() {
    setSenha("");
    setConfirmacaoSenha("");
  }

  function cancelEditing() {
    if (profile) {
      setNome(profile.nome);
      setNomeSocial(profile.nomeSocial);
    }
    clearPasswordFields();
    setFeedback(null);
    setEditing(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !token) return;

    const nextName = nome.trim();
    if (!nextName) {
      setFeedback({ message: "Informe seu nome.", isError: true });
      return;
    }
    if ((senha || confirmacaoSenha) && senha !== confirmacaoSenha) {
      setFeedback({ message: "A senha e a confirmação precisam ser iguais.", isError: true });
      return;
    }

    const update: ProfileUpdate = {};
    if (nextName !== profile.nome) update.nome = nextName;

    const nextSocialName = nomeSocial.trim();
    if (nextSocialName !== profile.nomeSocial) update.nomeSocial = nextSocialName;
    if (senha) update.senha = senha;

    if (Object.keys(update).length === 0) {
      setFeedback({ message: "Nenhuma alteração foi feita.", isError: false });
      setEditing(false);
      clearPasswordFields();
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await api<unknown>("/users/atualizar", {
        method: "PATCH",
        token,
        body: update,
      });

      const updatedProfile = { ...profile, ...update };
      setProfile(updatedProfile);
      setNome(updatedProfile.nome);
      setNomeSocial(updatedProfile.nomeSocial);
      if (update.nome !== undefined) updateUserName(update.nome);
      setFeedback({ message: "Perfil atualizado com sucesso.", isError: false });
      setEditing(false);
      clearPasswordFields();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : "Não foi possível atualizar seu perfil.",
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="center-msg" role="status">Carregando perfil…</p>;

  if (loadError) {
    return (
      <section className="card profile-page">
        <div>
          <h1>Meu perfil</h1>
          <p className="profile-feedback error" role="alert">{loadError}</p>
        </div>
        <div className="profile-actions">
          <button className="btn" type="button" onClick={() => setRetry((value) => value + 1)}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  if (!profile) return null;

  const readOnlyFields = [
    { label: "E-mail institucional", value: profile.email },
    { label: "E-mail secundário", value: profile.emailSecundario },
    { label: "Data de nascimento", value: formatDate(profile.dataNasc) },
    { label: "Naturalidade", value: profile.naturalidade },
    { label: "Nome da mãe", value: profile.nomeMae },
    { label: "Nome do pai", value: profile.nomePai },
    { label: "Sexo", value: profile.sexo },
    { label: "Raça", value: profile.raca },
    { label: "CPF", value: profile.cpf },
    { label: "RG", value: profile.rg },
    { label: "Órgão emissor", value: profile.orgaoEmissor },
    { label: "Estado", value: profile.estado },
    { label: "Data de emissão", value: formatDate(profile.dataEmissao) },
    { label: "Título de eleitor", value: profile.tituloNumero },
    { label: "Zona eleitoral", value: profile.zonaEleitoral },
    { label: "Seção eleitoral", value: profile.secaoEleitoral },
    { label: "UF do título", value: profile.ufTitulo },
    ...profile.endereco,
  ];

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <h1>Meu perfil</h1>
          <p className="muted">Consulte seus dados pessoais e mantenha seu perfil atualizado.</p>
        </div>
        {!editing && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setNome(profile.nome);
              setNomeSocial(profile.nomeSocial);
              setFeedback(null);
              setEditing(true);
            }}
          >
            Editar perfil
          </button>
        )}
      </header>

      {feedback && (
        <p className={`profile-feedback${feedback.isError ? " error" : ""}`} role={feedback.isError ? "alert" : "status"}>
          {feedback.message}
        </p>
      )}

      <form className="card profile-card" onSubmit={saveProfile}>
        <section aria-labelledby="profile-personal-heading">
          <h2 className="profile-section-title" id="profile-personal-heading">
            Dados pessoais
          </h2>
          <div className="profile-grid">
            {editing ? (
              <>
                <label className="profile-field">
                  Nome
                  <input
                    autoComplete="name"
                    required
                    value={nome}
                    onChange={(event) => {
                      setNome(event.target.value);
                      setFeedback(null);
                    }}
                  />
                </label>
                <label className="profile-field">
                  Nome social
                  <input
                    autoComplete="nickname"
                    value={nomeSocial}
                    onChange={(event) => {
                      setNomeSocial(event.target.value);
                      setFeedback(null);
                    }}
                  />
                </label>
              </>
            ) : (
              <>
                <ProfileField label="Nome" value={profile.nome} />
                <ProfileField label="Nome social" value={profile.nomeSocial} />
              </>
            )}
            {readOnlyFields.map(({ label, value }) => (
              <ProfileField key={label} label={label} value={value} />
            ))}
            {hasCargo(profile.cargos, "ALUNO") && (
              <ProfileField label="Matrícula" value={profile.matricula} />
            )}
            {hasCargo(profile.cargos, "PROFESSOR") && (
              <ProfileField label="SIAPE" value={profile.siape} />
            )}
          </div>
        </section>

        {editing && (
          <section aria-labelledby="profile-password-heading">
            <h2 className="profile-section-title" id="profile-password-heading">
              Alterar senha
            </h2>
            <p className="muted small">Deixe os campos em branco para manter sua senha atual.</p>
            <div className="profile-grid">
              <label className="profile-field">
                Nova senha
                <input
                  autoComplete="new-password"
                  type="password"
                  value={senha}
                  onChange={(event) => {
                    setSenha(event.target.value);
                    setFeedback(null);
                  }}
                />
              </label>
              <label className="profile-field">
                Confirmar nova senha
                <input
                  autoComplete="new-password"
                  type="password"
                  value={confirmacaoSenha}
                  onChange={(event) => {
                    setConfirmacaoSenha(event.target.value);
                    setFeedback(null);
                  }}
                />
              </label>
            </div>
          </section>
        )}

        {editing && (
          <div className="profile-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
            <button className="btn btn-ghost" type="button" disabled={saving} onClick={cancelEditing}>
              Cancelar
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
