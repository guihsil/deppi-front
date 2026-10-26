export const ROLE_ORDER = ["ADMIN", "DEPPI", "PROFESSOR", "ALUNO"] as const;

export type Role = (typeof ROLE_ORDER)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  DEPPI: "Equipe DEPPI",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
};

export type RouteDefinition = {
  path: string;
  label: string;
  roles: readonly Role[];
};

export const ROUTES: readonly RouteDefinition[] = [
  { path: "/admin", label: "Início", roles: ["ADMIN"] },
  { path: "/deppi", label: "Início", roles: ["DEPPI"] },
  { path: "/professor", label: "Início", roles: ["PROFESSOR"] },
  { path: "/aluno", label: "Início", roles: ["ALUNO"] },
];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_ORDER.some((role) => role === value);
}

export function homeFor(cargos: readonly Role[] = []): string {
  const role = ROLE_ORDER.find((candidate) => cargos.includes(candidate));
  if (!role) return "/login";
  return ROUTES.find((route) => route.roles.includes(role))?.path ?? "/login";
}
