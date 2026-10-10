import { requirePanelAccess } from '@/lib/auth/session';

export default async function AlunoPage() {
  await requirePanelAccess('/aluno');
  return <h1 className="text-2xl font-bold text-gray-900">Página do Aluno</h1>;
}
