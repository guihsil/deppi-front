export type EnrollmentStep = "RENDA" | "DOCUMENTOS" | "RESUMO";

export type EnrollmentDraft = {
  id: string;
  cursoId?: string;
  cursoNome?: string;
  etapa: EnrollmentStep;
  updatedAt: string;
};

const DRAFTS_UPDATED_EVENT = "deppi:enrollment-drafts-updated";

function storageKey(token: string): string {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
  }
  return `deppi:enrollment-drafts:${(hash >>> 0).toString(16)}`;
}

function isDraft(value: unknown): value is EnrollmentDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.id === "string" &&
    (draft.cursoId === undefined || typeof draft.cursoId === "string") &&
    (draft.cursoNome === undefined || typeof draft.cursoNome === "string") &&
    (draft.etapa === "RENDA" || draft.etapa === "DOCUMENTOS" || draft.etapa === "RESUMO") &&
    typeof draft.updatedAt === "string"
  );
}

function readDrafts(token: string): EnrollmentDraft[] {
  const saved = localStorage.getItem(storageKey(token));
  if (!saved) return [];

  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    throw new Error("Não foi possível recuperar o progresso salvo da inscrição.");
  }

  if (!Array.isArray(value) || !value.every(isDraft)) {
    throw new Error("O progresso salvo de uma inscrição está inválido.");
  }
  return value;
}

function writeDrafts(token: string, drafts: EnrollmentDraft[]) {
  localStorage.setItem(storageKey(token), JSON.stringify(drafts));
  window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
}

export function listEnrollmentDrafts(token: string): EnrollmentDraft[] {
  return readDrafts(token);
}

export function getEnrollmentDraft(token: string, id: string): EnrollmentDraft | undefined {
  return readDrafts(token).find((draft) => draft.id === id);
}

export function getEnrollmentDraftForCourse(
  token: string,
  cursoId: string,
): EnrollmentDraft | undefined {
  return readDrafts(token).find((draft) => draft.cursoId === cursoId);
}

export function saveEnrollmentDraft(token: string, draft: EnrollmentDraft) {
  const drafts = readDrafts(token);
  const index = drafts.findIndex((current) => current.id === draft.id);
  if (index >= 0) drafts[index] = draft;
  else drafts.push(draft);
  writeDrafts(token, drafts);
}

export function updateEnrollmentDraft(
  token: string,
  id: string,
  etapa: EnrollmentStep,
  course?: { id: string; nome: string },
) {
  const existing = getEnrollmentDraft(token, id);
  saveEnrollmentDraft(token, {
    id,
    ...(course?.id ? { cursoId: course.id } : existing?.cursoId ? { cursoId: existing.cursoId } : {}),
    ...(course?.nome
      ? { cursoNome: course.nome }
      : existing?.cursoNome
        ? { cursoNome: existing.cursoNome }
        : {}),
    etapa,
    updatedAt: new Date().toISOString(),
  });
}

export function enrollmentDraftsUpdatedEvent(): string {
  return DRAFTS_UPDATED_EVENT;
}
