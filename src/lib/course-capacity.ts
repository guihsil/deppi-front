import { ApiError } from "../api";

type CourseCapacity = {
  totalSeats?: number;
  availableSeats?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

function readEnrollmentCount(record: Record<string, unknown>): number | undefined {
  const count = record._count;
  const enrollmentValue =
    isRecord(count)
      ? count.inscricao
      : record.inscricao ?? record.inscricoes ?? record.quantidadeInscricoes ?? record.totalInscricoes;

  if (Array.isArray(enrollmentValue)) return enrollmentValue.length;
  return readNonNegativeInteger(enrollmentValue);
}

function readOptionalInteger(
  record: Record<string, unknown>,
  keys: string[],
  label: string,
): number | undefined {
  const key = keys.find((candidate) => record[candidate] !== undefined && record[candidate] !== null);
  if (!key) return undefined;

  const value = readNonNegativeInteger(record[key]);
  if (value === undefined) {
    throw new ApiError(`A API retornou ${label} em formato inválido.`, 502);
  }
  return value;
}

export function readCourseCapacity(record: Record<string, unknown>): CourseCapacity {
  const availableSeats = readOptionalInteger(
    record,
    ["vagasDisponiveis", "vagas_disponiveis"],
    "a quantidade de vagas disponíveis",
  );
  const totalSeats = readOptionalInteger(
    record,
    ["vagas", "quantidadeVagas"],
    "a quantidade total de vagas",
  );

  if (availableSeats !== undefined) return { totalSeats, availableSeats };
  if (totalSeats === undefined) return {};

  const enrollmentCount = readEnrollmentCount(record);
  return {
    totalSeats,
    ...(enrollmentCount === undefined
      ? {}
      : { availableSeats: Math.max(totalSeats - enrollmentCount, 0) }),
  };
}
