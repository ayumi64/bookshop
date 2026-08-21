'use client';

import { useFormState } from 'react-dom';
import type { FormState } from '@/app/(auth)/actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/forms/submit-button';
import { MailCheck } from 'lucide-react';

export function ForgotForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useFormState(action, {});

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <MailCheck className="h-8 w-8 text-success" aria-hidden="true" />
        <p className="font-medium">重置邮件已发送</p>
        <p className="text-sm text-muted-foreground">请查收邮箱并点击邮件中的链接设置新密码。</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <SubmitButton className="w-full">发送重置邮件</SubmitButton>
    </form>
  );
}
