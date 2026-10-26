"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthContext";
import { homeFor } from "../roles";

export default function Login() {
  const { login, ready, isAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && isAuth) router.replace("/");
  }, [ready, isAuth, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const { usuario } = await login(email.trim(), senha);
      const requestedPath = new URLSearchParams(window.location.search).get("from");
      const safePath =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : homeFor(usuario.cargos);
      router.replace(safePath);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível realizar o login.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || isAuth) return <p className="center-msg">Carregando…</p>;

  return (
    <div className="login">
      <section className="login-board" aria-hidden="true">
        <p className="board-title">Cada pessoa, um caminho de aprendizagem.</p>
        <svg viewBox="0 0 320 120" className="board-art">
          <rect x="8" y="70" width="304" height="26" rx="3" fill="#FFD84D" />
          {Array.from({ length: 15 }).map((_, index) => (
            <line
              key={index}
              x1={28 + index * 20}
              y1="70"
              x2={28 + index * 20}
              y2={index % 5 === 0 ? 90 : 82}
              stroke="#1B2B5B"
              strokeWidth="2"
            />
          ))}
          <path d="M40 54 L200 18 L212 30 L52 66 Z" fill="#fff" />
          <path d="M200 18 L222 12 L226 24 L212 30 Z" fill="#FF8FA3" />
        </svg>
      </section>

      <section className="login-form-wrap">
        <form className="card login-form" onSubmit={onSubmit}>
          <h1>Entrar no DEPPI</h1>
          <p className="muted">Use o e-mail institucional e a senha da sua conta.</p>

          <label>
            E-mail institucional
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          </label>

          {erro && <p className="alert" role="alert">{erro}</p>}

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <p className="muted small">
            Ainda não tem conta? <Link href="/cadastro">Crie sua conta</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
