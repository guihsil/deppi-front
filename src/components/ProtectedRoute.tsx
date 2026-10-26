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
  const { cargos } = useAuth();
  const router = useRouter();
  const allowed = roles.some((role) => cargos.includes(role));

  useEffect(() => {
    if (!allowed) router.replace("/403");
  }, [allowed, router]);

  return allowed ? children : <p className="center-msg">Verificando permissões…</p>;
}
