import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, CreditCard, Settings } from 'lucide-react';

export const metadata: Metadata = { title: '管理后台' };

/**
 * Admin overview (AC-M1). Server-side permission check: non-admins are bounced
 * to /books (the middleware already prevents the UI redirect, but the page
 * re-verifies for defense-in-depth).
 */
export default async function AdminHomePage() {
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect('/books');

  const supabase = createServiceClient();

  const [{ count: bookCount }, { count: paidCount }, { count: pendingCount }] = await Promise.all([
    supabase.from('books').select('id', { count: 'exact', head: true }),
    supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid'),
    supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  const stats = [
    { label: '图书总数', value: bookCount ?? 0 },
    { label: '已购订单', value: paidCount ?? 0 },
    { label: '待处理订单', value: pendingCount ?? 0 },
  ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">管理后台</h1>
      <p className="mt-1 text-muted-foreground">上架与管理图书、查看销售数据。</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link href="/admin/books" className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <BookOpen className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
              <CardTitle>图书管理</CardTitle>
              <CardDescription>上架 / 编辑 / 下架图书</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="mt-2">
                <span>管理图书 →</span>
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/purchases" className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CreditCard className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
              <CardTitle>订单记录</CardTitle>
              <CardDescription>查看购买记录（只读）</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="mt-2">
                <span>查看订单 →</span>
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/books" className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <Settings className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
              <CardTitle>前台书库</CardTitle>
              <CardDescription>预览公开书库页面</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="mt-2">
                <span>查看前台 →</span>
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
