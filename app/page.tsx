"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../src/auth/AuthContext";
import { homeFor } from "../src/roles";

export default function HomePage() {
  const { ready, isAuth, cargos } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready) router.replace(isAuth ? homeFor(cargos) : "/login");
  }, [ready, isAuth, cargos, router]);

  return <p className="center-msg">Carregando…</p>;
}
