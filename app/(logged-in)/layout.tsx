import { Suspense } from "react";
import ProtectedLayout from "./protected-layout";

export const instant = false;

export default function LoggedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="center-msg">Carregando…</p>}>
      <ProtectedLayout>{children}</ProtectedLayout>
    </Suspense>
  );
}
