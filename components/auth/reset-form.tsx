'use client';

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { createClient } from '@/lib/supabase/browser';
import { resetPasswordAction } from '@/app/(auth)/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/forms/submit-button';
import { Loader2, AlertTriangle } from 'lucide-react';

type Status = { kind: 'checking' } | { kind: 'ok' } | { kind: 'error'; text: string };

export function ResetPasswordClient() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [state, formAction] = useFormState(resetPasswordAction, {});

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        // Supabase places the recovery code/token in the URL hash (implicit) or
        // query param (PKCE). Exchange it for a session; updateUser then works.
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setStatus({ kind: 'error', text: '链接无效或已过期，请重新发起重置。' });
          return;
        }
        // If session exists (recovery), we can proceed.
        if (data.session) {
          setStatus({ kind: 'ok' });
          return;
        }
        // No session — the link may carry a code in the URL we can exchange.
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, ''),
        );
        const code = hashParams.get('code') || new URLSearchParams(window.location.search).get('code');
        let codeExchangeError: string | null = null;
        if (code) {
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchErr) codeExchangeError = exchErr.message;
        }
        const again = await supabase.auth.getSession();
        if (codeExchangeError || !again.data.session) {
          setStatus({ kind: 'error', text: '重置链接无效或已过期，请重新发起。' });
        } else {
          setStatus({ kind: 'ok' });
        }
      } catch {
        setStatus({ kind: 'error', text: '无法验证重置链接，请重新发起。' });
      }
    })();
  }, []);

  if (status.kind === 'checking') {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> 正在验证…
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'error') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" /> 链接无效
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{status.text}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>设置新密码</CardTitle>
        <CardDescription>为你的账号设置一个新密码。</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">新密码（至少 8 位）</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">确认新密码</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <SubmitButton className="w-full">保存新密码</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
