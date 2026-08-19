import type { Metadata } from 'next';
import Link from 'next/link';
import { loginAction } from '@/app/(auth)/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: '登录' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const notice =
    searchParams.registered === '1'
      ? { type: 'ok', text: '注册成功！欢迎邮件已发送，现在即可登录。' }
      : searchParams.reset === '1'
        ? { type: 'ok', text: '密码已重置，请使用新密码登录。' }
        : searchParams.error === 'invalid_request'
          ? { type: 'err', text: '链接无效或已过期，请重新发起。' }
          : null;

  const next = typeof searchParams.next === 'string' ? searchParams.next : '/reader';

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>欢迎回来</CardTitle>
          <CardDescription>登录以访问你的书架与阅读器。</CardDescription>
        </CardHeader>
        <CardContent>
          {notice && (
            <p
              role="status"
              className={`mb-4 rounded-md px-3 py-2 text-sm ${notice.type === 'ok' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
            >
              {notice.text}
            </p>
          )}
          <AuthForm
            action={loginAction}
            submitLabel="登录"
            fields={[
              { name: 'email', label: '邮箱', type: 'email', autoComplete: 'email', required: true },
              { name: 'password', label: '密码', type: 'password', autoComplete: 'current-password', required: true },
            ]}
          >
            <input type="hidden" name="next" value={next} />
          </AuthForm>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-primary hover:underline">忘记密码？</Link>
            <Link
              href={`/register${next !== '/reader' ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="text-primary hover:underline"
            >
              创建账号
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
