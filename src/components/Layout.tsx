"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABEL, ROLE_ORDER, ROUTES } from "../roles";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { usuario, cargos, logout } = useAuth();
  const pathname = usePathname();
  const roles = ROLE_ORDER.filter((role) => cargos.includes(role));
  const initials = (usuario?.nome ?? "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DEPPI</span>
        </div>

        <nav aria-label="Menu principal">
          {roles.map((role) => (
            <div key={role} className="nav-group">
              {roles.length > 1 && <p className="nav-title">{ROLE_LABEL[role]}</p>}
              {ROUTES.filter((route) => route.roles.includes(role)).map((route) => (
                <Link
                  key={route.path}
                  href={route.path}
                  className={`nav-link${pathname === route.path ? " active" : ""}`}
                  aria-current={pathname === route.path ? "page" : undefined}
                >
                  {route.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="me">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div className="me-text">
            <strong>{usuario?.nome}</strong>
            <small>{roles.map((role) => ROLE_LABEL[role]).join(", ")}</small>
          </div>
          <button className="btn btn-ghost" type="button" onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
