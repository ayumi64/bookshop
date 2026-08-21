'use client';

import { useFormState } from 'react-dom';
import type { FormState } from '@/app/(auth)/actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/forms/submit-button';

/**
 * Thin wrapper around useFormState for our auth Server Actions so errors are
 * shown inline and the submit button shows a loading state (AC-A5).
 */
export function AuthForm({
  action,
  children,
  submitLabel,
  fields,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  submitLabel: string;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    autoComplete?: string;
    minLength?: number;
    required?: boolean;
  }>;
}) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {children}
      {fields.map((f) => (
        <div key={f.name} className="space-y-2">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input
            id={f.name}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            minLength={f.minLength}
            required={f.required}
          />
        </div>
      ))}
      <SubmitButton className="w-full">{submitLabel}</SubmitButton>
    </form>
  );
}
