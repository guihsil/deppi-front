import Link from "next/link";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function ProfessorPage() {
  return (
    <ProtectedRoute roles={["PROFESSOR"]}>
      <section className="card">
        <h1 className="page-title">Área do professor</h1>
        <p className="muted mt-4">Cadastre cursos para a equipe DEPPI analisar e aprovar.</p>
        <Link className="btn mt-4" href="/professor/cursos">
          Cadastrar curso
        </Link>
      </section>
    </ProtectedRoute>
  );
}
