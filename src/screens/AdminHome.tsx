"use client";

import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../roles";

type EnrollmentStatus = "PENDENTE" | "DEFERIDO" | "INDEFERIDO" | "CANCELADO";
type CourseStatus = "ANDAMENTO" | "ANALISE" | "CONCLUIDO" | "FECHADO";

type DashboardData = {
  usuarios: { total: number; filtroCargos?: number };
  instituicoes: { total: number };
  cursos: {
    total: number;
    porStatus: Record<CourseStatus, number>;
    vagas: {
      totalOfertadas: number;
      totalInscritosDeferidos: number;
      vagasRestantes: number;
    };
  };
  inscricoes: { total: number; porStatus: Record<EnrollmentStatus, number> };
};

type ChartItem<T extends string> = { key: T; label: string; color: string };

const ENROLLMENTS: readonly ChartItem<EnrollmentStatus>[] = [
  { key: "PENDENTE", label: "Pendentes", color: "#F2A900" },
  { key: "DEFERIDO", label: "Deferidas", color: "#2E9E6B" },
  { key: "INDEFERIDO", label: "Indeferidas", color: "#D9534F" },
  { key: "CANCELADO", label: "Canceladas", color: "#7A8299" },
];
const COURSES: readonly ChartItem<CourseStatus>[] = [
  { key: "ANDAMENTO", label: "Em andamento", color: "#2F6FED" },
  { key: "ANALISE", label: "Em análise", color: "#F2A900" },
  { key: "CONCLUIDO", label: "Concluídos", color: "#2E9E6B" },
  { key: "FECHADO", label: "Fechados", color: "#7A8299" },
];
const DASHBOARD_ROLES: readonly Role[] = ["ALUNO", "PROFESSOR", "DEPPI", "ADMIN"];

function formatCount(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("pt-BR");
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "blue" | "green" | "yellow" | "pink";
}) {
  return (
    <div className={`card stat tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}

function Bars<T extends string>({
  items,
  data,
}: {
  items: readonly ChartItem<T>[];
  data: Record<T, number>;
}) {
  const maximum = Math.max(1, ...items.map(({ key }) => data[key] ?? 0));
  return (
    <ul className="bars">
      {items.map((item) => {
        const value = data[item.key] ?? 0;
        return (
          <li key={item.key}>
            <span className="bar-label">{item.label}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: `${(value / maximum) * 100}%`, background: item.color }}
              />
            </span>
            <strong>{formatCount(value)}</strong>
          </li>
        );
      })}
    </ul>
  );
}

function Donut({
  data,
  total,
}: {
  data: Record<CourseStatus, number>;
  total: number;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Cursos por situação">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#E6EAF4" strokeWidth="22" />
        {total > 0 &&
          COURSES.map((item) => {
            const length = ((data[item.key] ?? 0) / total) * circumference;
            const segment = (
              <circle
                key={item.key}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="22"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += length;
            return segment;
          })}
        <text x="70" y="68" textAnchor="middle" className="donut-n">{formatCount(total)}</text>
        <text x="70" y="86" textAnchor="middle" className="donut-t">cursos</text>
      </svg>
      <ul className="legend">
        {COURSES.map((item) => (
          <li key={item.key}>
            <span className="dot" style={{ background: item.color }} />
            {item.label}
            <strong>{formatCount(data[item.key])}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminHome() {
  const { token, usuario } = useAuth();
  const [cargos, setCargos] = useState<Role[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let active = true;
    const query = cargos.map((cargo) => `cargos=${encodeURIComponent(cargo)}`).join("&");
    const path = `/admin/dashboard/summary${query ? `?${query}` : ""}`;

    async function loadDashboard() {
      try {
        const result = await api<DashboardData>(path, { token });
        if (active) setData(result);
      } catch (error) {
        if (active) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [token, cargos, refreshCount]);

  function carregar() {
    setErro("");
    setLoading(true);
    setRefreshCount((count) => count + 1);
  }

  function toggleCargo(cargo: Role) {
    setErro("");
    setLoading(true);
    setCargos((current) =>
      current.includes(cargo)
        ? current.filter((item) => item !== cargo)
        : [...current, cargo],
    );
  }

  const vagas = data?.cursos.vagas;
  const percentage =
    vagas && vagas.totalOfertadas > 0
      ? Math.min(100, (vagas.totalInscritosDeferidos / vagas.totalOfertadas) * 100)
      : 0;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Início</h1>
          <p className="muted">
            Olá, {usuario?.nome?.split(" ")[0]}! Este é o resumo de como o DEPPI está hoje.
          </p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={carregar} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {erro && <p className="alert" role="alert">{erro}</p>}
      {!data && loading && (
        <p className="muted">Carregando os números… (o servidor pode demorar a acordar)</p>
      )}

      {data && (
        <div className={loading ? "dim" : undefined} aria-busy={loading}>
          <section className="stats" aria-label="Resumo">
            <Stat
              tone="blue"
              label="Usuários"
              value={formatCount(data.usuarios.total)}
              hint={
                data.usuarios.filtroCargos !== undefined
                  ? `${formatCount(data.usuarios.filtroCargos)} no filtro`
                  : "no sistema"
              }
            />
            <Stat tone="green" label="Instituições" value={formatCount(data.instituicoes.total)} hint="cadastradas" />
            <Stat tone="yellow" label="Cursos" value={formatCount(data.cursos.total)} hint="ofertados" />
            <Stat tone="pink" label="Inscrições" value={formatCount(data.inscricoes.total)} hint="recebidas" />
          </section>

          <section className="card filter" aria-label="Filtrar usuários por cargo">
            <span>Contar usuários por cargo:</span>
            {DASHBOARD_ROLES.map((cargo) => (
              <button
                key={cargo}
                type="button"
                className={`chip${cargos.includes(cargo) ? " on" : ""}`}
                aria-pressed={cargos.includes(cargo)}
                onClick={() => toggleCargo(cargo)}
              >
                {cargo[0] + cargo.slice(1).toLowerCase()}
              </button>
            ))}
          </section>

          <section className="grid2">
            <div className="card">
              <h2>Inscrições por situação</h2>
              <Bars items={ENROLLMENTS} data={data.inscricoes.porStatus} />
            </div>
            <div className="card">
              <h2>Cursos por situação</h2>
              <Donut data={data.cursos.porStatus} total={data.cursos.total} />
            </div>
          </section>

          <section className="card">
            <h2>Vagas</h2>
            <div
              className="meter"
              role="img"
              aria-label={`${percentage.toFixed(0)}% das vagas preenchidas`}
            >
              <span style={{ width: `${percentage}%` }} />
            </div>
            <div className="vagas">
              <div><strong>{formatCount(vagas?.totalOfertadas)}</strong><small>ofertadas</small></div>
              <div><strong>{formatCount(vagas?.totalInscritosDeferidos)}</strong><small>preenchidas (deferidas)</small></div>
              <div><strong>{formatCount(vagas?.vagasRestantes)}</strong><small>restantes</small></div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
