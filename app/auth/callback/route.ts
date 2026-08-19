import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE } from '@/lib/config';

/**
 * Auth redirect callback. Supabase OTP / password-reset links land here with a
 * `code` (and often fragment) which we exchange for a session, then forward.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/reader';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwarded = new URL(next, `${SITE.url}`);
      return NextResponse.redirect(forwarded.toString());
    }
  }

  // No valid code: send to login with a notice.
  const url = new URL('/login', `${SITE.url}`);
  url.searchParams.set('error', 'invalid_request');
  return NextResponse.redirect(url.toString());
}
