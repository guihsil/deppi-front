import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessAdminPath, parseRolesCookie, ROLE_COOKIE } from '@/lib/auth/roles';

const AUTH_COOKIE = 'deppi_token';
const PUBLIC_PATHS = ['/login', '/cadastro', '/access-denied'];
const CLIENT_AUTH_PATHS = ['/', '/403', '/admin', '/aluno', '/deppi', '/professor'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/backend/') ||
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`)) ||
    CLIENT_AUTH_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roles = parseRolesCookie(request.cookies.get(ROLE_COOKIE)?.value);

  if (!canAccessAdminPath(pathname, roles)) {
    return NextResponse.rewrite(new URL('/access-denied', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
