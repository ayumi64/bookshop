import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
}

/** Read the current auth user server-side (verifies via JWT/DB). */
export async function getCurrentUser(): Promise<AuthResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user };
}

/** True when the authenticated user's email is in the ADMIN_EMAILS list. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { user } = await getCurrentUser();
  if (!user?.email) return false;
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}
