import Link from 'next/link';
import { PANEL_MENUS } from '@/lib/auth/roles';
import { getSessionRoles } from '@/lib/auth/session';
import LogoutButton from './logout-button';

export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const roles = await getSessionRoles();
  const visibleMenus = PANEL_MENUS.filter(({ roles: allowedRoles }) =>
    allowedRoles.some((role) => roles.includes(role)),
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white p-4">
        <div className="mb-6 text-xl font-bold text-red-700">DEPPI</div>
        <nav aria-label="Painéis" className="flex flex-1 flex-col gap-2">
          {visibleMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="rounded p-2 text-gray-700 hover:bg-orange-100 hover:text-orange-800"
            >
              {menu.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-gray-200 pt-4">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}