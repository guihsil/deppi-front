import { cookies } from 'next/headers';
import { forbidden } from 'next/navigation';
import { PANEL_MENUS, parseRolesCookie, ROLE_COOKIE, type UserRole } from './roles';

export async function getSessionRoles(): Promise<UserRole[]> {
  const cookieStore = await cookies();
  return parseRolesCookie(cookieStore.get(ROLE_COOKIE)?.value);
}

export async function requirePanelAccess(path: string): Promise<void> {
  const menu = PANEL_MENUS.find(({ href }) => href === path);
  const roles = await getSessionRoles();

  if (!menu || !menu.roles.some((role) => roles.includes(role))) {
    forbidden();
  }
}
