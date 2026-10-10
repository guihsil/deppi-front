export const ROLE_COOKIE = 'deppi_roles';

export const USER_ROLES = ['Aluno', 'Professor', 'Deppi', 'Admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type PanelMenu = {
  label: string;
  href: string;
  roles: readonly UserRole[];
};

export const PANEL_MENUS: readonly PanelMenu[] = [
  { label: 'Painel do Aluno', href: '/aluno', roles: ['Aluno', 'Admin'] },
  {
    label: 'Painel do Professor',
    href: '/professor',
    roles: ['Professor', 'Admin', 'Deppi'],
  },
  { label: 'Painel do Deppi', href: '/deppi', roles: ['Deppi', 'Admin'] },
  { label: 'Painel do Admin', href: '/admin', roles: ['Admin'] },
];

export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLocaleLowerCase('pt-BR');
  return USER_ROLES.find((role) => role.toLocaleLowerCase('pt-BR') === normalized) ?? null;
}

export function normalizeRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map(normalizeRole).filter((role): role is UserRole => role !== null))];
}

export function parseRolesCookie(value: string | undefined): UserRole[] {
  if (!value) return [];
  return normalizeRoles(value.split(','));
}

export function canAccessAdminPath(pathname: string, roles: readonly UserRole[]): boolean {
  if (pathname === '/') return roles.length > 0;

  const menu = PANEL_MENUS.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );

  return menu?.roles.some((role) => roles.includes(role)) ?? false;
}
