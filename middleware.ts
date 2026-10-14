import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes and auth internal calls
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session')?.value;
  const parsed = session ? await decrypt(session) : null;

  const isAuthPage = pathname.startsWith('/login');
  
  if (!parsed && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (parsed && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
