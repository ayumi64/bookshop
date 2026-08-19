import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export const metadata: Metadata = { title: '订单记录' };

export const dynamic = 'force-dynamic';

const statusBadge: Record<string, { label: string; cls: 'success' | 'secondary' | 'destructive' }> = {
  paid: { label: '已支付', cls: 'success' },
  pending: { label: '待处理', cls: 'secondary' },
  refunded: { label: '已退款', cls: 'destructive' },
};

/**
 * Admin purchases view (AC-M4) — read-only order list with basic sales summary.
 * Uses the service-role client (users can never see others' purchases via RLS).
 */
export default async function AdminPurchasesPage() {
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect('/books');

  const supabase = createServiceClient();
  const [booksRes, purchasesRes] = await Promise.all([
    supabase.from('books').select('id, title, slug'),
    supabase
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const bookMap = new Map<string, { title: string; slug: string }>(
    (booksRes.data ?? []).map((b: any) => [b.id, b]),
  );

  const purchases = purchasesRes.data ?? [];
  const totalRevenue = purchases
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0);
  const paidCount = purchases.filter((p: any) => p.status === 'paid').length;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> 返回管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">订单记录</h1>
      <p className="mt-1 text-muted-foreground">
        共 {purchases.length} 条（最近 100）· 已支付 {paidCount} 笔 · 收入约{' '}
        {formatPrice(totalRevenue, 'usd')}（按币种近似显示）
      </p>

      {purchases.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-muted-foreground">暂无订单。开通 Stripe 并完成一单后将在此显示。</p>
          <Button asChild variant="outline"><Link href="/books">去前台购买一单 →</Link></Button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">书籍</th>
                <th className="px-4 py-3 font-medium">金额</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">用户</th>
                <th className="px-4 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchases.map((p: any) => {
                const book = bookMap.get(p.book_id);
                const badge = statusBadge[p.status] ?? statusBadge.pending;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      {book ? (
                        <Link href={`/books/${book.slug}`} className="hover:underline">
                          {book.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">(已删除)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatPrice(p.amount_cents || 0, p.currency)}</td>
                    <td className="px-4 py-3"><Badge variant={badge.cls}>{badge.label}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.user_id?.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
