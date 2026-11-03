export const ENROLLMENT_STATUSES = [
  { key: 'PENDENTE', label: 'Pendente', color: '#B45309' },
  { key: 'DEFERIDO', label: 'Deferida', color: '#15803D' },
  { key: 'INDEFERIDO', label: 'Indeferida', color: '#B91C1C' },
  { key: 'CANCELADO', label: 'Cancelada', color: '#5C5C5C' },
] as const;

export const COURSE_STATUSES = [
  { key: 'ANALISE', label: 'Em análise', color: '#B45309' },
  { key: 'ANDAMENTO', label: 'Em andamento', color: '#15803D' },
  { key: 'CONCLUIDO', label: 'Concluído', color: '#1D4ED8' },
  { key: 'FECHADO', label: 'Fechado', color: '#5C5C5C' },
] as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]['key'];
export type CourseStatus = (typeof COURSE_STATUSES)[number]['key'];

export type DashboardSummary = {
  usuarios: {
    total: number | null;
  };
  alunos: number;
  professores: number;
  instituicoes: {
    total: number | null;
  };
  cursos: {
    total: number | null;
    porStatus: Record<CourseStatus, number>;
    vagas: {
      totalOfertadas: number | null;
      totalInscritos: number | null;
      vagasRestantes: number | null;
    };
  };
  inscricoes: {
    total: number | null;
    porStatus: Record<EnrollmentStatus, number>;
  };
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, key: string): UnknownRecord {
  if (!isRecord(value) || !isRecord(value[key])) return {};
  return value[key];
}

function nullableCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function statusCounts<T extends string>(
  value: unknown,
  statuses: readonly { key: T }[],
): Record<T, number> {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(
    statuses.map(({ key }) => {
      const count = record[key];
      if (count === undefined) return [key, 0];

      const parsedCount = nullableCount(count);
      if (parsedCount === null) {
        throw new Error(`A API retornou um valor inválido para o status ${key}.`);
      }

      return [key, parsedCount];
    }),
  ) as Record<T, number>;
}

export function parseDashboardSummary(
  value: unknown,
  alunos: number,
  professores: number,
): DashboardSummary {
  const usuarios = recordAt(value, 'usuarios');
  const instituicoes = recordAt(value, 'instituicoes');
  const cursos = recordAt(value, 'cursos');
  const inscricoes = recordAt(value, 'inscricoes');
  const vagas = recordAt(cursos, 'vagas');

  return {
    usuarios: { total: nullableCount(usuarios.total) },
    alunos,
    professores,
    instituicoes: { total: nullableCount(instituicoes.total) },
    cursos: {
      total: nullableCount(cursos.total),
      porStatus: statusCounts(cursos.porStatus, COURSE_STATUSES),
      vagas: {
        totalOfertadas: nullableCount(vagas.totalOfertadas),
        totalInscritos: nullableCount(vagas.totalInscritos),
        vagasRestantes: nullableCount(vagas.vagasRestantes),
      },
    },
    inscricoes: {
      total: nullableCount(inscricoes.total),
      porStatus: statusCounts(inscricoes.porStatus, ENROLLMENT_STATUSES),
    },
  };
}

export function readFilteredUserCount(value: unknown): number | null {
  const usuarios = recordAt(value, 'usuarios');
  return nullableCount(usuarios.filtroCargos);
}

export function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('pt-BR').format(value);
}
