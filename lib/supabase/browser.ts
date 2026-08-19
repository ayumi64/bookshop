import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client (anon key; RLS enforced). Use only in client
 * components / event handlers. Server code must use `lib/supabase/server.ts`.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anon);
}
