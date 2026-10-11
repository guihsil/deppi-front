'use client';

import {
  BadgeCheck,
  Ban,
  Check,
  CircleX,
  Clock3,
  Hourglass,
  Lock,
  Play,
  Users,
  GraduationCap,
  BookOpen,
  Building,
  ClipboardList
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  COURSE_STATUSES,
  ENROLLMENT_STATUSES,
  formatCount,
  parseDashboardSummary,
  type DashboardSummary,
} from '@/lib/admin/dashboard';

type DashboardResponse = {
  summary?: unknown;
  alunos?: unknown;
  professores?: unknown;
  mensagem?: unknown;
};

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function hexToRgba(hex: string, alpha: number) {
  const cleanHex = hex.replace('#', '');
  const fullHex = cleanHex.length === 3 ? cleanHex.split('').map((char) => char + char).join('') : cleanHex;
  const numericValue = Number.parseInt(fullHex, 16);
  const r = (numericValue >> 16) & 255;
  const g = (numericValue >> 8) & 255;
  const b = numericValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function MetricCard({ title, value, note, icon: Icon }: { title: string; value: number | null; note?: string; icon?: React.ElementType }) {
  return (
    <article className="flex flex-col justify-center rounded-2xl border border-[#E4E1DB] bg-white p-5 shadow-[0_8px_24px_rgba(26,26,26,0.04)] min-w-[200px] shrink-0 snap-start">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="size-4 text-[#C2410C]" />}
        <h2 className="text-sm font-medium text-[#5C5C5C]">{title}</h2>
      </div>
      <p className="text-3xl font-bold tracking-tight text-[#1A1A1A]">{formatCount(value)}</p>
      {note && <p className="mt-1 text-xs text-[#6B6B6B]">{note}</p>}
    </article>
  );
}

function EnrollmentsChart({ summary }: { summary: DashboardSummary }) {
  const chartStatus = ENROLLMENT_STATUSES.map((status) => ({
    ...status,
    value: summary.inscricoes.porStatus[status.key],
    icon: {
      PENDENTE: Clock3,
      DEFERIDO: BadgeCheck,
      INDEFERIDO: CircleX,
      CANCELADO: Ban,
    }[status.key],
  }));
  const maximum = Math.max(...chartStatus.map(({ value }) => value), 0);
  const hasData = maximum > 0;

  return (
    <section className="rounded-2xl border border-[#E4E1DB] bg-white p-5 shadow-[0_8px_24px_rgba(26,26,26,0.04)]">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">Inscrições por situação</h2>
      <p className="mt-1 text-sm text-[#5C5C5C]">Distribuição das inscrições cadastradas</p>
      {hasData ? (
        <div className="mt-6 space-y-4" role="img" aria-label="Gráfico de barras horizontais de inscrições por situação">
          {chartStatus.map(({ key, label, color, value, icon: Icon }) => {
            const width = maximum === 0 ? 0 : (value / maximum) * 100;
            return (
              <div key={key} className="grid grid-cols-[170px_minmax(0,1fr)_48px] items-center gap-3">
                <div
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium"
                  style={{ backgroundColor: hexToRgba(color, 0.12), color }}
                >
                  {Icon && <Icon className="size-3.5" />}
                  {label}
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#F1EFEB]">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${width}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-right text-sm font-medium text-[#5C5C5C] tabular-nums">
                  {formatCount(value)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 rounded-xl bg-[#FAF9F7] p-5 text-center text-sm text-[#5C5C5C]">
          Ainda não há inscrições para exibir.
        </p>
      )}
    </section>
  );
}

function CoursesChart({ summary }: { summary: DashboardSummary }) {
  const chartStatus = COURSE_STATUSES.map((status) => ({
    ...status,
    value: summary.cursos.porStatus[status.key],
    icon: {
      ANALISE: Hourglass,
      ANDAMENTO: Play,
      CONCLUIDO: Check,
      FECHADO: Lock,
    }[status.key],
  }));
  const maximum = Math.max(...chartStatus.map(({ value }) => value), 0);
  const hasData = maximum > 0;

  return (
    <section className="rounded-2xl border border-[#E4E1DB] bg-white p-5 shadow-[0_8px_24px_rgba(26,26,26,0.04)]">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">Cursos por situação</h2>
      <p className="mt-1 text-sm text-[#5C5C5C]">Situação atual dos cursos cadastrados</p>
      {hasData ? (
        <div className="mt-6 space-y-4" role="img" aria-label="Gráfico de barras horizontais de cursos por situação">
          {chartStatus.map(({ key, label, color, value, icon: Icon }) => {
            const width = maximum === 0 ? 0 : (value / maximum) * 100;
            return (
              <div key={key} className="grid grid-cols-[170px_minmax(0,1fr)_48px] items-center gap-3">
                <div
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium"
                  style={{ backgroundColor: hexToRgba(color, 0.12), color }}
                >
                  {Icon && <Icon className="size-3.5" />}
                  {label}
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#F1EFEB]">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${width}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-right text-sm font-medium text-[#5C5C5C] tabular-nums">
                  {formatCount(value)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 rounded-xl bg-[#FAF9F7] p-5 text-center text-sm text-[#5C5C5C]">
          Ainda não há cursos para exibir.
        </p>
      )}
    </section>
  );
}

export default function DashboardView() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const response = await fetch('/api/admin/dashboard/summary', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = (await response.json()) as DashboardResponse;

        if (response.status === 401) {
          router.replace('/login?redirect=%2F');
          return;
        }
        if (response.status === 403) {
          router.replace('/access-denied');
          return;
        }
        if (!response.ok) {
          throw new Error(
            typeof data.mensagem === 'string'
              ? data.mensagem
              : 'Não foi possível carregar os indicadores.',
          );
        }
        if (!isCount(data.alunos) || !isCount(data.professores)) {
          throw new Error('A resposta da API não contém as contagens de alunos e professores.');
        }

        setSummary(parseDashboardSummary(data.summary, data.alunos, data.professores));
        setError('');
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Não foi possível carregar os indicadores.',
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [router, reloadKey]);

  function refreshDashboard() {
    setError('');
    setIsLoading(true);
    setReloadKey((value) => value + 1);
  }

  const metrics = useMemo(
    () =>
      summary
        ? [
            { title: 'Usuários', value: summary.usuarios.total, icon: Users },
            { title: 'Alunos', value: summary.alunos, icon: GraduationCap },
            { title: 'Professores', value: summary.professores, icon: BookOpen },
            { title: 'Cursos', value: summary.cursos.total, icon: Play },
            { title: 'Inscrições', value: summary.inscricoes.total, icon: ClipboardList },
            { title: 'Instituições', value: summary.instituicoes.total, icon: Building },
          ]
        : [],
    [summary],
  );

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const formattedDateCapitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[#E4E1DB] bg-white p-5 shadow-[0_8px_24px_rgba(26,26,26,0.04)]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">
            {greeting}, Usuário
          </h1>
          <p className="mt-2 text-sm text-[#5C5C5C]">{formattedDateCapitalized}</p>
        </div>
        <button
          type="button"
          onClick={refreshDashboard}
          disabled={isLoading}
          className="rounded-xl border border-[#D3D0C9] bg-[#F1EFEB] px-4 py-2 text-sm font-medium text-[#1A1A1A] transition hover:bg-[#EAE6E0] disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </header>

      {isLoading && !summary && (
        <p role="status" className="rounded-2xl border border-[#E4E1DB] bg-white p-6 text-[#5C5C5C] shadow-[0_8px_24px_rgba(26,26,26,0.04)]">
          Carregando indicadores...
        </p>
      )}

      {error && (
        <section role="alert" className="rounded-2xl border border-[#B42318]/30 bg-[#B42318]/10 p-5 text-[#B42318]">
          <h2 className="font-semibold">Não foi possível carregar o dashboard</h2>
          <p className="mt-1 text-sm">{error}</p>
          <button
            type="button"
            onClick={refreshDashboard}
            className="mt-4 rounded-lg bg-[#B42318] px-4 py-2 text-sm font-medium text-white hover:bg-[#8B1D16]"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {summary && (
        <>
          <section aria-label="Indicadores gerais" className="flex flex-row overflow-x-auto gap-4 pb-2 snap-x">
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section aria-label="Gráficos do dashboard" className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <EnrollmentsChart summary={summary} />
            <CoursesChart summary={summary} />
          </section>
        </>
      )}
    </div>
  );
}
