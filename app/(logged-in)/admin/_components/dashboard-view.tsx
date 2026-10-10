'use client';

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

function MetricCard({ title, value, note }: { title: string; value: number | null; note?: string }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-600">{title}</h2>
      <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">{formatCount(value)}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </article>
  );
}

function EnrollmentsChart({ summary }: { summary: DashboardSummary }) {
  const values = ENROLLMENT_STATUSES.map((status) => ({
    ...status,
    value: summary.inscricoes.porStatus[status.key],
  }));
  const maximum = Math.max(...values.map(({ value }) => value), 0);
  const hasData = maximum > 0;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Inscrições por situação</h2>
      <p className="mt-1 text-sm text-gray-500">Distribuição das inscrições cadastradas</p>
      {hasData ? (
        <div className="mt-6 space-y-5" role="img" aria-label="Gráfico de barras horizontais de inscrições por situação">
          {values.map(({ key, label, color, value }) => (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="tabular-nums text-gray-600">{formatCount(value)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${(value / maximum) * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-600">
          Ainda não há inscrições para exibir.
        </p>
      )}
    </section>
  );
}

function CoursesChart({ summary }: { summary: DashboardSummary }) {
  const values = COURSE_STATUSES.map((status) => ({
    ...status,
    value: summary.cursos.porStatus[status.key],
  }));
  const total = values.reduce((sum, { value }) => sum + value, 0);
  const segments = values
    .filter(({ value }) => value > 0)
    .reduce<{ stops: string[]; accumulated: number }>(
      ({ stops, accumulated }, { color, value }) => {
        const nextAccumulated = accumulated + (value / total) * 100;
        return {
          stops: [...stops, `${color} ${accumulated}% ${nextAccumulated}%`],
          accumulated: nextAccumulated,
        };
      },
      { stops: [], accumulated: 0 },
    ).stops;
  const chartStyle = {
    background: segments.length
      ? `conic-gradient(${segments.join(', ')})`
      : 'conic-gradient(#e5e7eb 0% 100%)',
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Cursos por situação</h2>
      <p className="mt-1 text-sm text-gray-500">Situação atual dos cursos cadastrados</p>
      {total > 0 ? (
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div
            className="grid size-48 shrink-0 place-items-center rounded-full"
            style={chartStyle}
            role="img"
            aria-label={`Gráfico circular das situações de ${formatCount(total)} cursos`}
          >
            <div className="grid size-28 place-content-center rounded-full bg-white text-center">
              <span className="text-2xl font-bold text-gray-900">{formatCount(total)}</span>
              <span className="text-xs text-gray-500">cursos</span>
            </div>
          </div>
          <ul className="w-full space-y-3 sm:w-auto">
            {values.map(({ key, label, color, value }) => (
              <li key={key} className="flex items-center justify-between gap-8 text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </span>
                <span className="tabular-nums text-gray-600">{formatCount(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-8 rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-600">
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
          router.replace('/login?redirect=%2Fadmin');
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
            { title: 'Usuários cadastrados', value: summary.usuarios.total },
            { title: 'Alunos', value: summary.alunos },
            { title: 'Professores', value: summary.professores },
            { title: 'Cursos', value: summary.cursos.total },
            { title: 'Inscrições', value: summary.inscricoes.total },
            { title: 'Instituições', value: summary.instituicoes.total },
            { title: 'Vagas ofertadas', value: summary.cursos.vagas.totalOfertadas },
            { title: 'Vagas ocupadas', value: summary.cursos.vagas.totalInscritos },
            { title: 'Vagas restantes', value: summary.cursos.vagas.vagasRestantes },
          ]
        : [],
    [summary],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">DEPPI · Administração</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Visão geral dos usuários, cursos, inscrições e vagas.</p>
        </div>
        <button
          type="button"
          onClick={refreshDashboard}
          disabled={isLoading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </header>

      {isLoading && !summary && (
        <p role="status" className="rounded-lg bg-white p-6 text-gray-600 shadow-sm">
          Carregando indicadores...
        </p>
      )}

      {error && (
        <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          <h2 className="font-semibold">Não foi possível carregar o dashboard</h2>
          <p className="mt-1 text-sm">{error}</p>
          <button
            type="button"
            onClick={refreshDashboard}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {summary && (
        <>
          <section aria-label="Indicadores gerais" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
