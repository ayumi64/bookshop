import type { Metadata } from 'next';
import Link from 'next/link';
import { forgotPasswordAction } from '@/app/(auth)/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ForgotForm } from '@/components/auth/forgot-form';

export const metadata: Metadata = { title: '忘记密码' };

export default function ForgotPasswordPage() {
  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>重置密码</CardTitle>
          <CardDescription>输入邮箱，我们将发送含安全 token 的重置链接。</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotForm action={forgotPasswordAction} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            记得密码了？{' '}
            <Link href="/login" className="text-primary hover:underline">返回登录</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
