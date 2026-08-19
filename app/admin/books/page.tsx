import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { publishBook, unpublishBook } from '@/app/admin/actions';

export const metadata: Metadata = { title: '图书管理' };

const statusBadge: Record<string, { label: string; cls: 'success' | 'secondary' | 'outline' }> = {
  published: { label: '已上架', cls: 'success' },
  draft: { label: '草稿', cls: 'secondary' },
  archived: { label: '已归档', cls: 'outline' },
};

/**
 * Admin books list (AC-M2/M3). Shows every book regardless of status so admin
 * can publish, unpublish, or edit. The storefront only renders `published`
 * books (AC-B3 / AC-M3 via listPublicBooks).
 */
export default async function AdminBooksPage() {
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect('/books');

  const supabase = createServiceClient();
  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-destructive">加载图书失败：{error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">图书管理</h1>
          <p className="mt-1 text-muted-foreground">共 {books?.length ?? 0} 本（含草稿 / 已归档）。</p>
        </div>
        <Button asChild>
          <Link href="/admin/books/new">＋ 上架新书</Link>
        </Button>
      </div>

      {!books || books.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-muted-foreground">还没有任何图书。</p>
          <Button asChild><Link href="/admin/books/new">上架第一本 →</Link></Button>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {books.map((book) => {
            const badge = statusBadge[book.status] ?? statusBadge.draft;
            const isPublished = book.status === 'published';
            return (
              <li key={book.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{book.title}</p>
                        <Badge variant={badge.cls}>{badge.label}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        /{book.slug} · {book.author || '佚名'}{book.category ? ` · ${book.category}` : ''}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        价格 {formatPrice(book.price_cents, book.currency)} · 试读前 {book.trial_chapters} 章 / {book.trial_percent}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/books/${book.id}/edit`}>编辑</Link>
                      </Button>
                      <form action={isPublished ? unpublishBook : publishBook}>
                        <input type="hidden" name="id" value={book.id} />
                        <Button variant={isPublished ? 'outline' : 'default'} size="sm" type="submit">
                          {isPublished ? '下架' : '上架'}
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
