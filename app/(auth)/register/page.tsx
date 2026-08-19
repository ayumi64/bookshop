import type { Metadata } from 'next';
import Link from 'next/link';
import { registerAction } from '@/app/(auth)/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: '创建账号' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const next = typeof searchParams.next === 'string' ? searchParams.next : '/reader';

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>创建账号</CardTitle>
          <CardDescription>注册即开始免费试读，无需立刻付费。</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm
            action={registerAction}
            submitLabel="创建账号"
            fields={[
              { name: 'displayName', label: '昵称（可选）', type: 'text', autoComplete: 'nickname' },
              { name: 'email', label: '邮箱', type: 'email', autoComplete: 'email', required: true },
              { name: 'password', label: '密码（至少 8 位）', type: 'password', autoComplete: 'new-password', minLength: 8, required: true },
              { name: 'confirm', label: '确认密码', type: 'password', autoComplete: 'new-password', minLength: 8, required: true },
            ]}
          >
            <input type="hidden" name="next" value={next} />
          </AuthForm>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            已有账号？{' '}
            <Link href={`/login${next !== '/reader' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-primary hover:underline">
              登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
