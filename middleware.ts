import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware: refreshes the Supabase auth session and enforces protection on
 * /reader and /admin by redirecting unauthenticated / unauthorised users
 * while preserving the intended redirect (`next` query param).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isReader = pathname.startsWith('/reader');
  const isAdmin = pathname.startsWith('/admin');

  // Protected page, not logged in → /login with next preserved.
  if ((isReader || isAdmin) && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdmin && user) {
    const email = user.email ?? '';
    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!admins.includes(email.toLowerCase())) {
      // Not an admin: bounce away from the admin area.
      return NextResponse.redirect(new URL('/books', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/reader/:path*', '/admin/:path*'],
};
