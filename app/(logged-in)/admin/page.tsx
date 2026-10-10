import { requirePanelAccess } from '@/lib/auth/session';
import DashboardView from './_components/dashboard-view';

export default async function AdminPanelPage() {
  await requirePanelAccess('/admin');
  return <DashboardView />;
}
