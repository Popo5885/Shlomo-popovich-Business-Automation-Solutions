import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const role = session?.user?.role;

  const isAdminArea = nextUrl.pathname.startsWith('/admin');
  const isClientArea = nextUrl.pathname.startsWith('/dashboard');
  const isConnectPage = nextUrl.pathname.startsWith('/connect');
  const isLoginPage = nextUrl.pathname === '/login';

  // /connect/* is publicly accessible (no auth required)
  if (isConnectPage) return NextResponse.next();

  if (isLoginPage) {
    if (isLoggedIn) {
      if (role === 'client') return NextResponse.redirect(new URL('/dashboard', nextUrl));
      return NextResponse.redirect(new URL('/admin', nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // Client cannot access admin area
  if (isAdminArea && role === 'client') {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  // Client area for clients only
  if (isClientArea && role !== 'client') {
    return NextResponse.redirect(new URL('/admin', nextUrl));
  }

  // Billing page: only super_admin and staff_billing
  if (nextUrl.pathname.startsWith('/admin/billing')) {
    if (role !== 'super_admin' && role !== 'staff_billing') {
      return NextResponse.redirect(new URL('/admin', nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|fonts|images).*)'],
};
