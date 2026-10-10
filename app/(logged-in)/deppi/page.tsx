import { requirePanelAccess } from '@/lib/auth/session';

export default async function DeppiPage() {
  await requirePanelAccess('/deppi');
  return <h1 className="text-2xl font-bold text-gray-900">Página do Deppi</h1>;
}
