import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readFilteredUserCount } from '@/lib/admin/dashboard';
import { backendApiUrl } from '@/lib/backend-api';
import { normalizeRoles, ROLE_COOKIE } from '@/lib/auth/roles';

type UpstreamResult = {
  response: Response;
  body: unknown;
};

async function fetchSummary(token: string, cargo?: string): Promise<UpstreamResult> {
  const url = new URL(backendApiUrl('/admin/dashboard/summary'));
  if (cargo) url.searchParams.set('cargos', cargo);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

function upstreamFailure(response: Response, body: unknown) {
  const message =
    typeof body === 'object' &&
    body !== null &&
    'mensagem' in body &&
    typeof body.mensagem === 'string'
      ? body.mensagem
      : response.status === 404
        ? 'O backend respondeu 404 para GET /admin/dashboard/summary. Verifique se essa rota existe no servidor que está em API_BASE_URL.'
        : `O backend respondeu HTTP ${response.status} ao consultar /admin/dashboard/summary.`;

  const status = response.status === 401 || response.status === 403 ? response.status : 502;
  return NextResponse.json({ mensagem: message }, { status });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('deppi_token')?.value;
  const roles = normalizeRoles(cookieStore.get(ROLE_COOKIE)?.value.split(','));

  if (!token) {
    return NextResponse.json({ mensagem: 'Sua sessão expirou. Entre novamente.' }, { status: 401 });
  }

  if (!roles.includes('Admin')) {
    return NextResponse.json({ mensagem: 'Você não tem permissão para acessar o dashboard.' }, { status: 403 });
  }

  try {
    const [general, students, professors] = await Promise.all([
      fetchSummary(token),
      fetchSummary(token, 'Aluno'),
      fetchSummary(token, 'Professor'),
    ]);

    for (const result of [general, students, professors]) {
      if (!result.response.ok) return upstreamFailure(result.response, result.body);
    }

    const studentCount = readFilteredUserCount(students.body);
    const professorCount = readFilteredUserCount(professors.body);

    if (studentCount === null || professorCount === null) {
      return NextResponse.json(
        { mensagem: 'A API não retornou as contagens filtradas de alunos e professores.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      summary: general.body,
      alunos: studentCount,
      professores: professorCount,
    });
  } catch {
    return NextResponse.json(
      { mensagem: 'Não foi possível conectar ao serviço de dashboard.' },
      { status: 502 },
    );
  }
}
