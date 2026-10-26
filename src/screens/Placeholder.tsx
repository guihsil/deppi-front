"use client";

import { useAuth } from "../auth/AuthContext";

export default function Placeholder() {
  const { usuario } = useAuth();
  return (
    <>
      <h1 className="page-title">Olá, {usuario?.nome?.split(" ")[0]}!</h1>
      <div className="card">
        <p className="muted">As telas deste cargo serão entregues nas próximas etapas.</p>
      </div>
    </>
  );
}
