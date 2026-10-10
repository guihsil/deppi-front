import { requirePanelAccess } from '@/lib/auth/session';

export default async function ProfessorPage() {
  await requirePanelAccess('/professor');
  return <h1 className="text-2xl font-bold text-gray-900">Página do Professor</h1>;
}
