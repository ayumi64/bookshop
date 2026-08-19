import { createServerClient, type SetAllCookies, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Supabase client bound to the request's cookies (anon key + RLS).
 * Use ONLY in Server Components / Server Actions / Route Handlers.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions),
            );
          } catch {
            // Called from a Server Component; safe to ignore when middleware
            // is refreshing user sessions.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. BYPASSES RLS — reserved for trusted server contexts:
 * Stripe webhook writes, admin writes, seed. Never expose to the browser.
 */
export function createServiceClient() {
  const { createClient: raw } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  return raw(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
