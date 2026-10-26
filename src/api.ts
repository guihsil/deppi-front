const API_BASE = "/backend";

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

type ApiErrorBody = {
  mensagem?: unknown;
  error?: unknown;
  erros?: unknown;
};

export type ApiFieldError = { campo: string; mensagem: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: ApiFieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const body = data as ApiErrorBody;
  if (typeof body.mensagem === "string") return body.mensagem;
  if (typeof body.error === "string") return body.error;
  return undefined;
}

function fieldErrors(data: unknown): ApiFieldError[] {
  if (typeof data !== "object" || data === null) return [];
  const { erros } = data as ApiErrorBody;
  if (!Array.isArray(erros)) return [];
  return erros.flatMap((item): ApiFieldError[] => {
    if (typeof item !== "object" || item === null) return [];
    const { campo, mensagem } = item as Record<string, unknown>;
    return typeof campo === "string" && typeof mensagem === "string"
      ? [{ campo, mensagem }]
      : [];
  });
}

export async function api<T>(
  path: string,
  { method = "GET", body, token, auth = true }: ApiOptions = {},
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        // Em upload (FormData) o navegador define o Content-Type com o boundary.
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Não foi possível falar com o servidor. Tente novamente.", 0);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (response.ok) {
      throw new ApiError("O servidor retornou uma resposta inválida.", response.status);
    }
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && auth && typeof window !== "undefined") {
      window.dispatchEvent(new Event("deppi:unauthorized"));
    }
    throw new ApiError(
      errorMessage(data) ?? "Algo deu errado.",
      response.status,
      fieldErrors(data),
    );
  }

  return data as T;
}
