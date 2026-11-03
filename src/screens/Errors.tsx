"use client";

import Link from "next/link";
import { useAuth } from "../auth/AuthContext";
import { homeFor } from "../roles";

function ErrorPage({
  code,
  title,
  text,
}: {
  code: string;
  title: string;
  text: string;
}) {
  const { cargos } = useAuth();

  return (
    <div className="card error-page">
      <span className="error-code">{code}</span>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      <Link className="btn" href={homeFor(cargos)}>Voltar ao início</Link>
    </div>
  );
}

export function Forbidden() {
  return (
    <ErrorPage
      code="403"
      title="Você não tem permissão para ver esta página"
      text="Seu cargo não dá acesso a esta área. Se isso for um engano, fale com a equipe do DEPPI."
    />
  );
}

export function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="Página não encontrada"
      text="O endereço digitado não existe."
    />
  );
}
