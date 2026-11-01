"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeFor } from "../roles";

// ── Contrato do backend (POST /auth/cadastro) ──
const SEXOS = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMININO", label: "Feminino" },
] as const;

const RACAS = [
  { value: "AMARELA", label: "Amarela" },
  { value: "BRANCA", label: "Branca" },
  { value: "PARDA", label: "Parda" },
  { value: "PRETA", label: "Preta" },
  { value: "INDIGENA", label: "Indígena" },
  { value: "NAO_DECLARADO", label: "Não declarado" },
] as const;

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CPF_REGEX = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ETAPAS = [
  "Dados pessoais",
  "Acesso",
  "Endereço",
  "Identidade",
  "Título de eleitor",
] as const;

const CAMPOS_POR_ETAPA: (keyof Errors)[][] = [
  ["nome", "nomeSocial", "dataNasc", "naturalidade", "nomeMae", "nomePai", "sexo", "raca", "matricula"],
  ["email", "emailSecundario", "senha", "confirmarSenha"],
  ["rua", "bairro", "numero", "cep"],
  ["rg", "cpf", "orgaoEmissor", "estado", "dataEmissao"],
  ["tituloNumero", "zonaEleitoral", "secaoEleitoral", "ufTitulo"],
];

type FormState = {
  nome: string;
  nomeSocial: string;
  dataNasc: string;
  naturalidade: string;
  email: string;
  emailSecundario: string;
  senha: string;
  confirmarSenha: string;
  nomeMae: string;
  nomePai: string;
  matricula: string;
  sexo: string;
  raca: string;
  rua: string;
  bairro: string;
  numero: string;
  cep: string;
  rg: string;
  cpf: string;
  orgaoEmissor: string;
  estado: string;
  dataEmissao: string;
  tituloNumero: string;
  zonaEleitoral: string;
  secaoEleitoral: string;
  ufTitulo: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

const INITIAL: FormState = {
  nome: "",
  nomeSocial: "",
  dataNasc: "",
  naturalidade: "",
  email: "",
  emailSecundario: "",
  senha: "",
  confirmarSenha: "",
  nomeMae: "",
  nomePai: "",
  matricula: "",
  sexo: "",
  raca: "",
  rua: "",
  bairro: "",
  numero: "",
  cep: "",
  rg: "",
  cpf: "",
  orgaoEmissor: "",
  estado: "",
  dataEmissao: "",
  tituloNumero: "",
  zonaEleitoral: "",
  secaoEleitoral: "",
  ufTitulo: "",
};

type Resultado = { destino: string; avisos: string[] };

function validate(form: FormState): Errors {
  const e: Errors = {};
  const nome = form.nome.trim();

  if (nome.length < 3) e.nome = "Nome deve ter ao menos 3 caracteres.";
  if (!DATA_REGEX.test(form.dataNasc)) e.dataNasc = "Informe a data de nascimento.";
  if (form.naturalidade.trim().length < 2) e.naturalidade = "Naturalidade é obrigatória.";
  if (!EMAIL_REGEX.test(form.email.trim())) e.email = "E-mail institucional inválido.";
  if (form.emailSecundario.trim() && !EMAIL_REGEX.test(form.emailSecundario.trim())) {
    e.emailSecundario = "E-mail secundário inválido.";
  }
  if (form.senha.length < 6) e.senha = "Senha deve ter ao menos 6 caracteres.";
  if (form.confirmarSenha !== form.senha) e.confirmarSenha = "As senhas não conferem.";
  if (form.nomeMae.trim().length < 3) e.nomeMae = "Informe o nome da mãe.";
  if (form.nomePai.trim().length < 3) e.nomePai = "Informe o nome do pai.";
  if (!form.matricula.trim()) e.matricula = "Matrícula é obrigatória.";
  if (!SEXOS.some((s) => s.value === form.sexo)) e.sexo = "Selecione o sexo.";
  if (!RACAS.some((r) => r.value === form.raca)) e.raca = "Selecione a raça.";

  if (form.rua.trim().length < 2) e.rua = "Informe a rua.";
  if (form.bairro.trim().length < 2) e.bairro = "Informe o bairro.";
  if (!/^[1-9]\d*$/.test(form.numero.trim())) e.numero = "Informe o número (inteiro positivo).";
  if (form.cep.replace(/\D/g, "").length !== 8) e.cep = "CEP deve ter 8 dígitos.";

  if (form.rg.trim().length < 5) e.rg = "RG inválido.";
  if (!CPF_REGEX.test(form.cpf.trim())) e.cpf = "CPF inválido.";
  if (form.orgaoEmissor.trim().length < 2) e.orgaoEmissor = "Órgão emissor é obrigatório.";
  if (form.estado.trim().length !== 2) e.estado = "Use 2 letras (ex: CE).";
  if (!DATA_REGEX.test(form.dataEmissao)) e.dataEmissao = "Informe a data de emissão.";

  if (!form.tituloNumero.trim()) e.tituloNumero = "Número do título é obrigatório.";
  if (!form.zonaEleitoral.trim()) e.zonaEleitoral = "Zona eleitoral é obrigatória.";
  if (!form.secaoEleitoral.trim()) e.secaoEleitoral = "Seção eleitoral é obrigatória.";
  if (form.ufTitulo.trim().length !== 2) e.ufTitulo = "Use 2 letras (ex: CE).";

  return e;
}

function errorsForStep(errors: Errors, step: number): Errors {
  const stepErrors: Errors = {};
  for (const field of CAMPOS_POR_ETAPA[step]) {
    if (errors[field]) stepErrors[field] = errors[field];
  }
  return stepErrors;
}

function buildPayload(form: FormState) {
  const payload: Record<string, unknown> = {
    nome: form.nome.trim(),
    dataNasc: form.dataNasc,
    naturalidade: form.naturalidade.trim(),
    email: form.email.trim(),
    senha: form.senha,
    nomeMae: form.nomeMae.trim(),
    nomePai: form.nomePai.trim(),
    matricula: form.matricula.trim(),
    sexo: form.sexo,
    raca: form.raca,
    endereco: {
      rua: form.rua.trim(),
      bairro: form.bairro.trim(),
      numero: Number(form.numero.trim()),
      cep: Number(form.cep.replace(/\D/g, "")),
    },
    cargo: "ALUNO", // o cadastro público cria apenas alunos
    rg: form.rg.trim(),
    cpf: form.cpf.trim(),
    orgaoEmissor: form.orgaoEmissor.trim(),
    estado: form.estado.trim().toUpperCase(),
    dataEmissao: form.dataEmissao,
  };

  if (form.nomeSocial.trim()) payload.nomeSocial = form.nomeSocial.trim();
  if (form.emailSecundario.trim()) payload.emailSecundario = form.emailSecundario.trim();

  payload.tituloNumero = form.tituloNumero.trim();
  payload.zonaEleitoral = form.zonaEleitoral.trim();
  payload.secaoEleitoral = form.secaoEleitoral.trim();
  payload.ufTitulo = form.ufTitulo.trim().toUpperCase();

  return payload;
}

function FieldError({ message }: { message?: string | undefined }) {
  return message ? (
    <span className="field-error" role="alert">
      {message}
    </span>
  ) : null;
}

export default function Cadastro() {
  const { login } = useAuth();
  const router = useRouter();
  const submitting = useRef(false);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [etapa, setEtapa] = useState(0);

  function field(name: keyof FormState) {
    return {
      name,
      value: form[name],
      "aria-invalid": errors[name] ? true : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = event.target.value;
        setForm((current) => ({ ...current, [name]: value }));
      },
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    if (etapa < ETAPAS.length - 1) {
      const found = errorsForStep(validate(form), etapa);
      setErrors(found);
      setErro("");
      if (Object.keys(found).length > 0) {
        setErro("Revise os campos destacados.");
        return;
      }

      setEtapa((current) => current + 1);
      return;
    }

    const found = validate(form);
    setErrors(found);
    setErro("");
    if (Object.keys(found).length > 0) {
      setErro("Revise os campos destacados.");
      return;
    }

    submitting.current = true;
    setLoading(true);

    try {
      // 1. Cadastro do aluno
      await api("/auth/cadastro", {
        method: "POST",
        body: buildPayload(form),
        auth: false,
      });

      // Sessão (mesmo fluxo do login) para obter cargos e destino
      const avisos: string[] = [];
      let destino = "/login";
      try {
        const session = await login(form.email.trim(), form.senha);
        destino = homeFor(session.usuario.cargos);
      } catch {
        avisos.push("Cadastro realizado, mas não foi possível entrar automaticamente. Faça login.");
      }

      if (avisos.length === 0) {
        router.replace(destino);
      } else {
        setResultado({ destino, avisos });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const porCampo: Errors = {};
        for (const item of error.fieldErrors) {
          const key = item.campo as keyof Errors;
          if (key in INITIAL && !porCampo[key]) porCampo[key] = item.mensagem;
        }
        setErrors(porCampo);
        const etapaComErro = CAMPOS_POR_ETAPA.findIndex((campos) =>
          campos.some((campo) => porCampo[campo]),
        );
        if (etapaComErro >= 0) setEtapa(etapaComErro);
        setErro(error.message);
      } else {
        setErro("Não foi possível realizar o cadastro.");
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  if (resultado) {
    return (
      <main className="cadastro">
        <section className="card cadastro-form">
          <h1>Cadastro realizado</h1>
          {resultado.avisos.map((aviso) => (
            <p key={aviso} className="alert" role="status">
              {aviso}
            </p>
          ))}
          <button className="btn" type="button" onClick={() => router.replace(resultado.destino)}>
            Continuar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="cadastro">
      <form className="card cadastro-form" onSubmit={onSubmit} noValidate>
        <div>
          <h1>Criar conta de aluno</h1>
          <p className="muted">Preencha seus dados para acessar o DEPPI.</p>
        </div>

        <div>
          <p className="muted small" aria-live="polite">
            Etapa {etapa + 1} de {ETAPAS.length}: {ETAPAS[etapa]}
          </p>
          <ol className="cadastro-progress" aria-label="Etapas do cadastro">
            {ETAPAS.map((nome, index) => (
              <li
                key={nome}
                className={index === etapa ? "current" : index < etapa ? "completed" : undefined}
                aria-current={index === etapa ? "step" : undefined}
              >
                <span className="cadastro-progress-number">{index + 1}</span>
                <span>{nome}</span>
              </li>
            ))}
          </ol>
        </div>

        {etapa === 0 && <fieldset disabled={loading}>
          <legend>Dados pessoais</legend>
          <div className="form-grid">
            <label className="span2">
              Nome completo
              <input type="text" autoComplete="name" {...field("nome")} />
              <FieldError message={errors.nome} />
            </label>
            <label className="span2">
              Nome social (opcional)
              <input type="text" {...field("nomeSocial")} />
              <FieldError message={errors.nomeSocial} />
            </label>
            <label>
              Data de nascimento
              <input type="date" autoComplete="bday" {...field("dataNasc")} />
              <FieldError message={errors.dataNasc} />
            </label>
            <label>
              Naturalidade
              <input type="text" {...field("naturalidade")} />
              <FieldError message={errors.naturalidade} />
            </label>
            <label>
              Sexo
              <select {...field("sexo")}>
                <option value="">Selecione</option>
                {SEXOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.sexo} />
            </label>
            <label>
              Raça
              <select {...field("raca")}>
                <option value="">Selecione</option>
                {RACAS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.raca} />
            </label>
            <label>
              Nome da mãe
              <input type="text" {...field("nomeMae")} />
              <FieldError message={errors.nomeMae} />
            </label>
            <label>
              Nome do pai
              <input type="text" {...field("nomePai")} />
              <FieldError message={errors.nomePai} />
            </label>
            <label>
              Matrícula
              <input type="text" {...field("matricula")} />
              <FieldError message={errors.matricula} />
            </label>
          </div>
        </fieldset>}

        {etapa === 1 && <fieldset disabled={loading}>
          <legend>Acesso</legend>
          <div className="form-grid">
            <label>
              E-mail institucional
              <input type="email" autoComplete="username" {...field("email")} />
              <FieldError message={errors.email} />
            </label>
            <label>
              E-mail secundário
              <input type="email" autoComplete="email" {...field("emailSecundario")} />
              <FieldError message={errors.emailSecundario} />
            </label>
            <label>
              Senha
              <input type="password" autoComplete="new-password" {...field("senha")} />
              <FieldError message={errors.senha} />
            </label>
            <label>
              Confirmar senha
              <input type="password" autoComplete="new-password" {...field("confirmarSenha")} />
              <FieldError message={errors.confirmarSenha} />
            </label>
          </div>
        </fieldset>}

        {etapa === 2 && <fieldset disabled={loading}>
          <legend>Endereço</legend>
          <div className="form-grid">
            <label className="span2">
              Rua
              <input type="text" autoComplete="street-address" {...field("rua")} />
              <FieldError message={errors.rua} />
            </label>
            <label>
              Bairro
              <input type="text" {...field("bairro")} />
              <FieldError message={errors.bairro} />
            </label>
            <label>
              Número
              <input type="text" inputMode="numeric" {...field("numero")} />
              <FieldError message={errors.numero} />
            </label>
            <label>
              CEP
              <input type="text" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" {...field("cep")} />
              <FieldError message={errors.cep} />
            </label>
          </div>
        </fieldset>}

        {etapa === 3 && <fieldset disabled={loading}>
          <legend>Identidade</legend>
          <div className="form-grid">
            <label>
              RG
              <input type="text" {...field("rg")} />
              <FieldError message={errors.rg} />
            </label>
            <label>
              CPF
              <input type="text" inputMode="numeric" placeholder="000.000.000-00" {...field("cpf")} />
              <FieldError message={errors.cpf} />
            </label>
            <label>
              Órgão emissor
              <input type="text" {...field("orgaoEmissor")} />
              <FieldError message={errors.orgaoEmissor} />
            </label>
            <label>
              UF do órgão emissor
              <input type="text" maxLength={2} placeholder="CE" {...field("estado")} />
              <FieldError message={errors.estado} />
            </label>
            <label>
              Data de emissão
              <input type="date" {...field("dataEmissao")} />
              <FieldError message={errors.dataEmissao} />
            </label>
          </div>
        </fieldset>}

        {etapa === 4 && <fieldset disabled={loading}>
          <legend>Título de eleitor</legend>
          <div className="form-grid">
            <label>
              Número
              <input type="text" inputMode="numeric" {...field("tituloNumero")} />
              <FieldError message={errors.tituloNumero} />
            </label>
            <label>
              UF
              <input type="text" maxLength={2} placeholder="CE" {...field("ufTitulo")} />
              <FieldError message={errors.ufTitulo} />
            </label>
            <label>
              Zona eleitoral
              <input type="text" inputMode="numeric" {...field("zonaEleitoral")} />
              <FieldError message={errors.zonaEleitoral} />
            </label>
            <label>
              Seção eleitoral
              <input type="text" inputMode="numeric" {...field("secaoEleitoral")} />
              <FieldError message={errors.secaoEleitoral} />
            </label>
          </div>
        </fieldset>}

        {erro && (
          <p className="alert" role="alert">
            {erro}
          </p>
        )}

        <div className="cadastro-actions">
          {etapa > 0 && (
            <button
              className="btn btn-ghost"
              type="button"
              disabled={loading}
              onClick={() => {
                setEtapa((current) => current - 1);
                setErrors({});
                setErro("");
              }}
            >
              Voltar
            </button>
          )}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Cadastrando…" : etapa === ETAPAS.length - 1 ? "Criar conta" : "Próximo"}
          </button>
        </div>
        <p className="muted small">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
