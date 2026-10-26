"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "../src/components/Layout";
import { useAuth } from "../src/auth/AuthContext";
import { NotFound } from "../src/screens/Errors";

export default function NotFoundPage() {
  const { ready, isAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !isAuth) router.replace("/login");
  }, [ready, isAuth, router]);

  if (!ready || !isAuth) return <p className="center-msg">Carregando…</p>;

  return (
    <Layout>
      <NotFound />
    </Layout>
  );
}
