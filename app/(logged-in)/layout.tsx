"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Layout from "../../src/components/Layout";
import { useAuth } from "../../src/auth/AuthContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { ready, isAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !isAuth) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [ready, isAuth, pathname, router]);

  if (!ready || !isAuth) return <p className="center-msg">Carregando…</p>;
  return <Layout>{children}</Layout>;
}
