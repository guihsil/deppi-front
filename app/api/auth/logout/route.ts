import { NextResponse } from 'next/server';
import { ROLE_COOKIE } from '@/lib/auth/roles';

export async function POST() {
  const response = NextResponse.json({ mensagem: 'Sessão encerrada.' });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };

  response.cookies.set('deppi_token', '', cookieOptions);
  response.cookies.set(ROLE_COOKIE, '', cookieOptions);

  return response;
}
