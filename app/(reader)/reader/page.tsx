import type { Metadata } from 'next';
import Link from 'next/link';
import { listBooksWithPurchase, getMyProgress } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageOff, CheckCircle2, PlayCircle, Circle, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export const metadata: Metadata = { title: '我的书架' };

type ProgressRow = { bookId: string; chapterSlug: string | null; percent: number | null };

export default async function ReaderShelfPage() {
  const { user } = await getCurrentUser();
  if (!user) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="font-medium">请先登录以访问你的书架。</p>
        <Button asChild className="mt-4"><Link href="/login">去登录</Link></Button>
      </div>
    );
  }

  const books = await listBooksWithPurchase(user.id);
  const progressRows = await Promise.all(
    books.filter((b) => b.purchased).map(async (b) => ({
      bookId: b.id,
      progress: await getMyProgress(user.id, b.id),
    })),
  );
  const progressByBook = new Map<string, ProgressRow['percent']>();
  progressRows.forEach((p) => {
    progressByBook.set(p.bookId, p.progress?.percent ?? null);
  });

  const purchased = books.filter((b) => b.purchased);
  const reading = purchased.filter((b) => (progressByBook.get(b.id) ?? 0) > 0 && (progressByBook.get(b.id) ?? 0) < 100);
  const completed = purchased.filter((b) => (progressByBook.get(b.id) ?? 0) >= 100);
  const unread = purchased.filter((b) => ![...reading.map((x) => x.id), ...completed.map((x) => x.id)].includes(b.id));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">我的书架</h1>
      <p className="mt-1 text-muted-foreground">你购买的书都在这里，多设备续读。</p>

      {purchased.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-muted-foreground">书架还是空的。</p>
          <Button asChild><Link href="/books">去书库浏览 →</Link></Button>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          <ShelfSection title="阅读中" books={reading} progress={progressByBook} showClock />
          <ShelfSection title="未读" books={unread} progress={progressByBook} showClock={false} />
          <ShelfSection title="已读完" books={completed} progress={progressByBook} showClock={false} />
        </div>
      )}
    </div>
  );
}

function ShelfSection({
  title,
  books,
  progress,
  showClock,
}: {
  title: string;
  books: import('@/lib/types').BookWithPurchase[];
  progress: Map<string, number | null>;
  showClock: boolean;
}) {
  if (books.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
        {showClock ? <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 bp480:grid-cols-2 bp780:grid-cols-3">
        {books.map((book) => {
          const pct = progress.get(book.id) ?? 0;
          return (
            <Link key={book.id} href={`/reader/${book.slug}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium line-clamp-1">{book.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{book.author || '佚名'}</p>
                    </div>
                    {pct >= 100 ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <PlayCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                    </div>
                    <p className="mt-2 text-sm text-primary">继续阅读 →</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
