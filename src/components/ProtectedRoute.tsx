"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../roles";

export default function ProtectedRoute({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: React.ReactNode;
}) {
  const { cargos, ready } = useAuth();
  const router = useRouter();
  const allowed = ready && roles.some((role) => cargos.includes(role));

  useEffect(() => {
    if (ready && !allowed) router.replace("/403");
  }, [ready, allowed, router]);

  if (allowed) return children;
  return (
    <p className="center-msg" role="status">
      {ready ? "Verificando permissões…" : "Carregando sessão…"}
    </p>
  );
}
