import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicBookBySlug, listChapters, getMyPurchase, withContentAccess } from '@/lib/data';
import { getReviewsBundle } from '@/lib/reviews';
import { getCurrentUser } from '@/lib/auth';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpenText, Lock, Check, ChevronLeft } from 'lucide-react';
import { PurchaseButton } from '@/components/books/purchase-button';
import { BookReviews } from '@/components/reviews/book-reviews';

export const metadata: Metadata = { title: '书籍详情' };

export default async function BookDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // AC-P1 login-return intent: PurchaseButton stores `?buy=<bookId>` before
  // going to /login on an unauthenticated unlock. After login we land back
  // here with that query so the book page can auto-continue into Checkout.
  // Pass only the raw value; the client button matches it against its bookId.
  const buyIntent =
    typeof searchParams.buy === 'string' ? searchParams.buy : undefined;
  const book = await getPublicBookBySlug(params.slug);
  if (!book) notFound();

  const { user } = await getCurrentUser();
  const isLoggedIn = !!user;
  const purchase =
    user ? await getMyPurchase(user.id, book.id) : null;
  const purchased = purchase?.status === 'paid';

  const chapters = await listChapters(book.id);
  const accessChapters = withContentAccess(chapters, book, purchased);
  const total = chapters.length;
  // Trial chapters are the ones with content available to the anon viewer.
  const trialCount = accessChapters.filter((c) => c.content !== null).length;

  // Phase 2 — Ratings & Reviews bundle (read via aggregate table; SSR-safe).
  const reviewsBundle = await getReviewsBundle(book.id, user?.id, 5);

  const price = formatPrice(book.price_cents, book.currency);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> 返回书库
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-[260px_1fr]">
        <div>
          <div className="relative aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-lg border bg-muted">
            {book.cover_url ? (
              <Image src={book.cover_url} alt={`${book.title} 封面`} fill className="object-cover" sizes="260px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <BookOpenText className="h-16 w-16" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold">{book.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {book.author || '佚名'}
            {book.category ? ` · ${book.category}` : ''}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Badge variant={purchased ? 'success' : 'secondary'}>
              {purchased ? <>已购 ✓</> : book.price_cents === 0 ? '免费' : price}
            </Badge>
            {!purchased && book.price_cents > 0 && (
              <span className="text-sm text-muted-foreground">买断拥有 · 多端续读</span>
            )}
          </div>

          {book.blurb && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary">简介</summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{book.blurb}</p>
            </details>
          )}

          {/* Phase 2 — 评分与评论：置于购买 CTA 上方（决策在前、付费在后，design §0/§3.1） */}
          <BookReviews
            book={{ id: book.id, slug: book.slug, title: book.title }}
            stats={reviewsBundle.stats}
            reviews={reviewsBundle.reviews}
            total={reviewsBundle.total}
            mine={reviewsBundle.mine}
            isLoggedIn={isLoggedIn}
            viewerPurchased={reviewsBundle.viewerPurchased}
          />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {purchased ? (
              <Button asChild size="lg">
                <Link href={`/reader/${book.slug}`}>已购 · 开始阅读</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/reader/${book.slug}?trial=1`}>试读第一章</Link>
                </Button>
                <PurchaseButton
                  bookId={book.id}
                  bookSlug={book.slug}
                  isLoggedIn={isLoggedIn}
                  label={book.price_cents === 0 ? '免费获取' : `解锁 ${price}`}
                  size="lg"
                  autoTrigger={buyIntent === book.id}
                />
              </>
            )}
          </div>

          {!purchased && (
            <p className="mt-2 text-sm text-muted-foreground">
              可免费试读前 {trialCount} 章（约前 {Math.min(trialCount, total)}/{total}），其余锁定。
            </p>
          )}
        </div>
      </div>

      <section className="mt-10" aria-label="章节目录">
        <h2 className="mb-3 text-lg font-semibold">章节目录</h2>
        <ol className="divide-y rounded-lg border">
          {chapters.map((ch, idx) => {
            const readable = purchased || accessChapters[idx]?.content != null;
            return (
              <li key={ch.id}>
                {readable ? (
                  <Link
                    href={`/reader/${book.slug}#${ch.slug}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
                  >
                    <span>{ch.title}</span>
                    {purchased ? (
                      <Check className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : (
                      <Badge variant="secondary">试读</Badge>
                    )}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                    <span>{ch.title}</span>
                    <Lock className="h-4 w-4" aria-label="已锁定" aria-hidden="true" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {!purchased && trialCount < total && (
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" /> 其余章节解锁后即可阅读
          </p>
        )}
      </section>
    </div>
  );
}
