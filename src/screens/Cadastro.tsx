"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { homeFor } from "../roles";

// ── Contrato do backend (POST /auth/cadastro e POST /documentos/:id/enviar) ──
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

const TIPOS_HISTORICO = ["application/pdf", "image/jpeg", "image/png"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CPF_REGEX = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  sexo: string;
  raca: string;
  fkEndereco: string;
  rg: string;
  cpf: string;
  orgaoEmissor: string;
  estado: string;
  dataEmissao: string;
  tituloNumero: string;
  zonaEleitoral: string;
  secaoEleitoral: string;
  ufTitulo: string;
  inscricaoId: string;
};

type Errors = Partial<Record<keyof FormState | "historico", string>>;

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
  sexo: "",
  raca: "",
  fkEndereco: "",
  rg: "",
  cpf: "",
  orgaoEmissor: "",
  estado: "",
  dataEmissao: "",
  tituloNumero: "",
  zonaEleitoral: "",
  secaoEleitoral: "",
  ufTitulo: "",
  inscricaoId: "",
};

type CadastroResponse = {
  mensagem?: string;
  token?: string;
};

type Resultado = { destino: string; avisos: string[] };

function validate(form: FormState, incluiTitulo: boolean, historico: File | null): Errors {
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
  if (!SEXOS.some((s) => s.value === form.sexo)) e.sexo = "Selecione o sexo.";
  if (!RACAS.some((r) => r.value === form.raca)) e.raca = "Selecione a raça.";

  if (!/^[1-9]\d*$/.test(form.fkEndereco.trim())) {
    e.fkEndereco = "Informe o código (número inteiro positivo) do endereço.";
  }

  if (form.rg.trim().length < 5) e.rg = "RG inválido.";
  if (!CPF_REGEX.test(form.cpf.trim())) e.cpf = "CPF inválido.";
  if (form.orgaoEmissor.trim().length < 2) e.orgaoEmissor = "Órgão emissor é obrigatório.";
  if (form.estado.trim().length !== 2) e.estado = "Use 2 letras (ex: CE).";
  if (!DATA_REGEX.test(form.dataEmissao)) e.dataEmissao = "Informe a data de emissão.";

  if (incluiTitulo) {
    if (!form.tituloNumero.trim()) e.tituloNumero = "Número do título é obrigatório.";
    if (!form.zonaEleitoral.trim()) e.zonaEleitoral = "Zona eleitoral é obrigatória.";
    if (!form.secaoEleitoral.trim()) e.secaoEleitoral = "Seção eleitoral é obrigatória.";
    if (form.ufTitulo.trim().length !== 2) e.ufTitulo = "Use 2 letras (ex: CE).";
  }

  if (historico) {
    if (!TIPOS_HISTORICO.includes(historico.type)) {
      e.historico = "Envie um arquivo PDF, JPG ou PNG.";
    } else if (historico.size > TAMANHO_MAXIMO) {
      e.historico = "O arquivo deve ter no máximo 5 MB.";
    }
  }

  return e;
}

function buildPayload(form: FormState, incluiTitulo: boolean) {
  const payload: Record<string, unknown> = {
    nome: form.nome.trim(),
    dataNasc: form.dataNasc,
    naturalidade: form.naturalidade.trim(),
    email: form.email.trim(),
    senha: form.senha,
    nomeMae: form.nomeMae.trim(),
    nomePai: form.nomePai.trim(),
    sexo: form.sexo,
    raca: form.raca,
    fkEndereco: Number(form.fkEndereco.trim()),
    cargo: "ALUNO", // o cadastro público cria apenas alunos
    rg: form.rg.trim(),
    cpf: form.cpf.trim(),
    orgaoEmissor: form.orgaoEmissor.trim(),
    estado: form.estado.trim().toUpperCase(),
    dataEmissao: form.dataEmissao,
  };

  if (form.nomeSocial.trim()) payload.nomeSocial = form.nomeSocial.trim();
  if (form.emailSecundario.trim()) payload.emailSecundario = form.emailSecundario.trim();

  if (incluiTitulo) {
    payload.tituloNumero = form.tituloNumero.trim();
    payload.zonaEleitoral = form.zonaEleitoral.trim();
    payload.secaoEleitoral = form.secaoEleitoral.trim();
    payload.ufTitulo = form.ufTitulo.trim().toUpperCase();
  }

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
  const [incluiTitulo, setIncluiTitulo] = useState(false);
  const [historico, setHistorico] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

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

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    setHistorico(event.target.files?.[0] ?? null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const found = validate(form, incluiTitulo, historico);
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
      const cadastro = await api<CadastroResponse>("/auth/cadastro", {
        method: "POST",
        body: buildPayload(form, incluiTitulo),
        auth: false,
      });

      // 2. Sessão (mesmo fluxo do login) para obter cargos e destino
      const avisos: string[] = [];
      let destino = "/login";
      try {
        const session = await login(form.email.trim(), form.senha);
        destino = homeFor(session.usuario.cargos);
      } catch {
        avisos.push("Cadastro realizado, mas não foi possível entrar automaticamente. Faça login.");
      }

      // 3. Envio opcional do histórico (rota de documentos)
      if (historico) {
        const inscricaoId = form.inscricaoId.trim();
        if (!inscricaoId || !cadastro.token) {
          avisos.push(
            "O histórico não foi enviado: o envio exige o código de uma inscrição, que ainda não existe. Envie-o depois de se inscrever.",
          );
        } else {
          try {
            const dados = new FormData();
            dados.append("file", historico);
            dados.append("categoria", "HISTORICO_ESCOLAR");
            await api(`/documentos/${encodeURIComponent(inscricaoId)}/enviar`, {
              method: "POST",
              body: dados,
              token: cadastro.token,
            });
          } catch (error) {
            const motivo = error instanceof Error ? ` ${error.message}` : "";
            avisos.push(`O cadastro foi concluído, mas o histórico não foi enviado.${motivo}`);
          }
        }
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

        <fieldset disabled={loading}>
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
          </div>
        </fieldset>

        <fieldset disabled={loading}>
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
        </fieldset>

        <fieldset disabled={loading}>
          <legend>Endereço</legend>
          <div className="form-grid">
            <label className="span2">
              Código do endereço
              <input type="text" inputMode="numeric" {...field("fkEndereco")} />
              <FieldError message={errors.fkEndereco} />
            </label>
          </div>
        </fieldset>

        <fieldset disabled={loading}>
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
        </fieldset>

        <fieldset disabled={loading}>
          <legend>Título de eleitor</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={incluiTitulo}
              onChange={(event) => setIncluiTitulo(event.target.checked)}
            />
            Quero informar meu título de eleitor
          </label>
          {incluiTitulo && (
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
          )}
        </fieldset>

        <fieldset disabled={loading}>
          <legend>Histórico (opcional)</legend>
          <div className="form-grid">
            <label className="span2">
              Documento de histórico (PDF, JPG ou PNG, até 5 MB)
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={onFile} />
              <FieldError message={errors.historico} />
            </label>
            {historico && (
              <label className="span2">
                Código da inscrição
                <input type="text" {...field("inscricaoId")} />
                <span className="muted small">
                  O envio do histórico é vinculado a uma inscrição. Sem o código, ele não será enviado.
                </span>
              </label>
            )}
          </div>
        </fieldset>

        {erro && (
          <p className="alert" role="alert">
            {erro}
          </p>
        )}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Cadastrando…" : "Criar conta"}
        </button>
        <p className="muted small">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
