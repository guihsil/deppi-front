import Link from 'next/link';
import { cookies } from 'next/headers';
import { PANEL_MENUS, parseRolesCookie, ROLE_COOKIE } from '@/lib/auth/roles';

export default async function Forbidden() {
  const cookieStore = await cookies();
  const roles = parseRolesCookie(cookieStore.get(ROLE_COOKIE)?.value);
  const accessibleMenus = PANEL_MENUS.filter(({ roles: allowedRoles }) =>
    allowedRoles.some((role) => roles.includes(role)),
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold tracking-widest text-orange-700">ERRO 403</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Acesso negado</h1>
        <p className="mt-3 text-gray-600">
          Seu usuário não possui cargo autorizado para acessar esta área.
        </p>

        {accessibleMenus.length > 0 ? (
          <nav aria-label="Áreas disponíveis" className="mt-6 flex flex-col gap-2">
            <p className="mb-1 text-sm font-medium text-gray-700">Você pode acessar:</p>
            {accessibleMenus.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
              >
                {menu.label}
              </Link>
            ))}
          </nav>
        ) : (
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
          >
            Ir para o login
          </Link>
        )}
      </section>
    </main>
  );
}
