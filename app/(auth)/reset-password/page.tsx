import type { Metadata } from 'next';
import { ResetPasswordClient } from '@/components/auth/reset-form';

export const metadata: Metadata = { title: '重置密码' };

export default function ResetPasswordPage() {
  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <ResetPasswordClient />
    </div>
  );
}
