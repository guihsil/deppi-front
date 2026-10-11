import { redirect } from 'next/navigation';
import { getSessionRoles } from '@/lib/auth/session';

export default async function LoggedInRootPage() {
  const roles = await getSessionRoles();
  const primaryRole = roles[0];

  if (primaryRole === 'Admin') redirect('/admin');
  if (primaryRole === 'Deppi') redirect('/deppi');
  if (primaryRole === 'Professor') redirect('/professor');
  if (primaryRole === 'Aluno') redirect('/aluno');

  return (
    <section>
      <h1 className="text-2xl font-bold text-gray-900">Painéis DEPPI</h1>
      <p className="mt-2 text-gray-600">Selecione um painel no menu para continuar.</p>
    </section>
  );
}
