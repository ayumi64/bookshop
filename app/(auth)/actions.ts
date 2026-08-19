'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SITE } from '@/lib/config';
import { sendWelcomeEmail } from '@/lib/mail';

/**
 * Server Actions (PRD §5.2, §5.6; Server Actions 校验 §7.1).
 * Each returns `{ ok: boolean; error?: string }` for inline display via
 * useFormState; on success they may `redirect` (the browser then navigates).
 */

export type FormState = { ok?: boolean; error?: string };

/** Register (FR-A-01, FR-A-05, AC-A2). Welcome mail is non-blocking (AC-E3). */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();
  const next = String(formData.get('next') ?? '/reader');

  if (!email || !password || !confirm)
    return { ok: false, error: '请填写所有必填字段。' };
  if (password.length < 8) return { ok: false, error: '密码至少 8 位。' };
  if (password !== confirm) return { ok: false, error: '两次输入的密码不一致。' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: '请输入有效的邮箱地址。' };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split('@')[0] },
      emailRedirectTo: `${SITE.url}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: humanizeAuthError(error.message) };

  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      display_name: displayName || email.split('@')[0],
    });
  }

  // Welcome mail must not block (AC-E3).
  if (data.user) await sendWelcomeEmail(data.user.email ?? email, displayName || email.split('@')[0]);

  // Session present (no forced verification) → straight to reader/shelf.
  redirect(data.session ? (next.startsWith('/') ? next : '/reader') : '/login?registered=1');
}

/** Login (FR-A-02, AC-A3). */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/reader');

  if (!email || !password) return { ok: false, error: '请输入邮箱和密码。' };
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: error.message === 'Invalid login credentials'
      ? '邮箱或密码错误。'
      : humanizeAuthError(error.message) };
  }
  redirect(next.startsWith('/') ? next : '/reader');
}

/** Forgot password (FR-A-03, AC-A4): Auth emails a token reset link. */
export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { ok: false, error: '请输入邮箱。' };
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE.url}/reset-password`,
  });
  if (error) return { ok: false, error: humanizeAuthError(error.message) };
  return { ok: true };
}

/** Reset password (FR-A-04). Requires an active recovery session. */
export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { ok: false, error: '密码至少 8 位。' };
  if (password !== confirm) return { ok: false, error: '两次输入的密码不一致。' };

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: humanizeAuthError(error.message) };
  redirect('/login?reset=1');
}

/** Logout (FR-A-06). */
export async function signOutAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}

function humanizeAuthError(msg: string): string {
  const map: Record<string, string> = {
    'User already registered': '该邮箱已注册，请直接登录。',
    'Email not confirmed': '邮箱尚未确认。',
    'Invalid login credentials': '邮箱或密码错误。',
    'For security purposes, you can only request this once after 60 seconds.':
      '请稍候再试（每分钟最多一次）。',
  };
  return map[msg] ?? msg;
}
