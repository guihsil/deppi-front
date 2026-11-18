import { ApiError } from "../api";

export const statusLabels = {
  PENDENTE: "Pendente",
  DEFERIDO: "Deferido",
  INDEFERIDO: "Indeferido",
  CANCELADO: "Cancelado",
};

type Status = keyof typeof statusLabels;
type User = { nome: string; emailInstitucional?: string | null };

export type Enrollment = {
  id: string;
  data: string;
  status: Status;
  aluno: { matricula: string; usuario: User };
  curso: { id: string; nome: string; vagas: number };
};

export type HistoryEvent = {
  id: number;
  alteracao: string;
  descricao: string;
  statusAnterior: Status;
  statusAtual: Status;
  dataModificacao: string;
  usuario: User;
};

export type EnrollmentDetail = Enrollment & {
  rendaFamiliar: { rendaFamiliar: number | string; numeroPessoas: number } | null;
  historico: HistoryEvent[];
};

export type EnrollmentDocument = {
  id: string;
  nomeOriginal: string;
  caminho: string;
  tipoMime: string;
  tamanho: number;
  categoria: string | null;
  criadoEm: string;
};

export const actions = {
  aprovar: { label: "Aprovar", status: "DEFERIDO", success: "Inscrição aprovada com sucesso" },
  rejeitar: { label: "Rejeitar", status: "INDEFERIDO", success: "Inscrição rejeitada com sucesso" },
  cancelar: { label: "Cancelar", status: "CANCELADO", success: "Inscrição cancelada com sucesso" },
};

export type Decision = keyof typeof actions;

export function canDecide(action: Decision, { status, curso }: Enrollment) {
  switch (action) {
    case "aprovar": return status === "PENDENTE" && curso.vagas > 0;
    case "rejeitar": return status !== "INDEFERIDO";
    case "cancelar": return status !== "CANCELADO";
  }
}

export const ruleMessages: ReadonlyMap<string, string> = new Map([
  ["Não há vagas disponíveis nesse curso", "O curso está sem vagas disponíveis."],
  ["Só inscrições pendentes podem ser aprovadas", "Somente inscrições pendentes podem ser aprovadas."],
  ["Essa inscrição já está rejeitada", "A inscrição já está indeferida."],
  ["Essa inscrição já está cancelada", "A inscrição já está cancelada."],
]);

export const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
export const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function canRetry(error: ApiError) {
  return error.status === 0 || error.status >= 500 || (error.status >= 200 && error.status < 300);
}

export function asApiError(error: unknown) {
  return error instanceof ApiError ? error : new ApiError("Não foi possível concluir a operação.", 0);
}

export function courseEnrollmentPath(courseId: string, view: "pending" | "reviewed" = "pending") {
  const page = view === "pending" ? "inscricoes" : "alunos-inscritos";
  return `/deppi/cursos/${encodeURIComponent(courseId)}/${page}`;
}

export function decisionSuccess(value: string | string[] | undefined) {
  return typeof value === "string" && Object.hasOwn(actions, value)
    ? actions[value as Decision].success
    : undefined;
}
