import { NextResponse } from 'next/server';
import { normalizeRoles, ROLE_COOKIE } from '@/lib/auth/roles';
import { backendApiUrl } from '@/lib/backend-api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ mensagem: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.email !== 'string' ||
    typeof body.senha !== 'string' ||
    !body.email.trim() ||
    !body.senha
  ) {
    return NextResponse.json(
      { mensagem: 'Informe um e-mail e uma senha válidos.' },
      { status: 400 },
    );
  }

  let upstream: Response;

  try {
    upstream = await fetch(backendApiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: body.email,
        senha: body.senha,
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { mensagem: 'Não foi possível conectar ao serviço de autenticação.' },
      { status: 502 },
    );
  }

  let result: unknown;

  try {
    result = await upstream.json();
  } catch {
    return NextResponse.json(
      { mensagem: 'O serviço de autenticação retornou uma resposta inválida.' },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const mensagem =
      isRecord(result) && typeof result.mensagem === 'string'
        ? result.mensagem
        : 'Não foi possível realizar o login.';

    return NextResponse.json({ mensagem }, { status: upstream.status });
  }

  if (!isRecord(result) || typeof result.token !== 'string' || !result.token) {
    return NextResponse.json(
      { mensagem: 'A resposta do serviço de autenticação não contém um token válido.' },
      { status: 502 },
    );
  }

  const response = NextResponse.json({
    mensagem: typeof result.mensagem === 'string' ? result.mensagem : 'Login realizado com sucesso.',
    usuario: result.usuario ?? null,
  });

  response.cookies.set('deppi_token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  const user = isRecord(result.usuario) ? result.usuario : null;
  const roles = normalizeRoles(user?.cargos);

  response.cookies.set(ROLE_COOKIE, roles.join(','), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  return response;
}
