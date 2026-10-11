import Link from 'next/link';
import { getSessionRoles } from '@/lib/auth/session';
import { BookOpen, ClipboardList, Home, LayoutGrid, Menu, MoonStar, GraduationCap, Building, Users, BarChart, User, IdCard } from 'lucide-react';
import LogoutButton from './logout-button';

export const instant = false;

const ROLE_LABELS = {
  Aluno: 'Aluno',
  Professor: 'Professor',
  Deppi: 'Deppi',
  Admin: 'Administrador',
} as const;

type NavItem = { label: string; href: string; icon: React.ElementType };

const MENUS_BY_ROLE: Record<string, NavItem[]> = {
  Aluno: [
    { label: 'Início', href: '/aluno', icon: Home },
    { label: 'Cursos', href: '/cursos', icon: GraduationCap },
    { label: 'Minhas Inscrições', href: '/inscricoes', icon: ClipboardList },
    { label: 'Perfil', href: '/perfil', icon: User },
  ],
  Deppi: [
    { label: 'Início', href: '/deppi', icon: Home },
    { label: 'Cursos', href: '/cursos', icon: GraduationCap },
    { label: 'Inscrições', href: '/inscricoes', icon: ClipboardList },
    { label: 'Professores', href: '/professores', icon: IdCard },
    { label: 'Perfil', href: '/perfil', icon: User },
  ],
  Admin: [
    { label: 'Início', href: '/admin', icon: Home },
    { label: 'Cursos', href: '/cursos', icon: GraduationCap },
    { label: 'Instituições', href: '/instituicoes', icon: Building },
    { label: 'Usuários', href: '/usuarios', icon: Users },
    { label: 'Relatórios', href: '/relatorios', icon: BarChart },
    { label: 'Perfil', href: '/perfil', icon: User },
  ],
  Professor: [
    { label: 'Início', href: '/professor', icon: Home },
    { label: 'Meus Cursos', href: '/cursos', icon: GraduationCap },
    { label: 'Perfil', href: '/perfil', icon: User },
  ]
};

export default async function LoggedInLayout({ children }: { children: React.ReactNode }) {
  const roles = await getSessionRoles();
  const primaryRole = roles[0] ?? 'Aluno';
  const roleName = ROLE_LABELS[primaryRole as keyof typeof ROLE_LABELS] ?? 'Usuário';
  
  const initials = roleName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'US';

  const visibleMenus = MENUS_BY_ROLE[primaryRole] || MENUS_BY_ROLE['Aluno'];

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#1A1A1A]">
      <div className="flex min-h-screen">
        <aside className="flex w-[280px] flex-col border-r border-[#E4E1DB] bg-[#F4F3EF]">
          <div className="px-5 pb-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-[#C2410C] text-lg font-bold text-white shadow-sm">
                D
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#5C5C5C]">DEPPI</div>
                <div className="text-[11px] font-semibold text-[#5C5C5C]">IFCE · Extensão</div>
              </div>
            </div>
          </div>

          <nav aria-label="Navegação Principal" className="flex flex-1 flex-col gap-2 px-4 pt-4 pb-4">
            {visibleMenus.map((menu) => {
              const Icon = menu.icon;
              return (
                <Link
                  key={menu.label}
                  href={menu.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#5C5C5C] transition hover:bg-[#FFFFFF] hover:text-[#1A1A1A]"
                >
                  <Icon className="h-4 w-4" />
                  <span>{menu.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-[#E4E1DB] p-4">
            <LogoutButton />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#E4E1DB] bg-white/90 px-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-lg border border-[#E4E1DB] bg-[#F1EFEB] text-[#1A1A1A] transition hover:border-[#D3D0C9] hover:bg-[#EAE6E0]"
                aria-label="Abrir ou fechar menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold text-[#1A1A1A]">Dashboard</div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-lg border border-[#E4E1DB] bg-[#F1EFEB] text-[#D97706] transition hover:border-[#D3D0C9] hover:bg-[#EAE6E0]"
                aria-label="Alternar tema"
              >
                <MoonStar className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#1A1A1A]">Usuário</div>
                  <div className="text-[11px] text-[#5C5C5C]">{roleName}</div>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#C2410C] text-xs font-bold text-white">
                  {initials}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 bg-[#FAF9F7] p-6 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
