import type { Metadata } from 'next';
import Link from 'next/link';
import { listBooksWithPurchase } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/books/book-card';

export const metadata: Metadata = { title: '在线书店 + 阅读器' };

export default async function LandingPage() {
  const { user } = await getCurrentUser();
  const books = await listBooksWithPurchase(user?.id);
  const featured = books.slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-muted/60 to-background">
        <div className="container mx-auto max-w-5xl px-4 py-20 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
            免费试读 · 买断拥有 · 多端续读
          </p>
          <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            沉浸在每一页好书中
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            精选公版 / 自有授权内容，无广告、无订阅负担的沉浸阅读体验。
            试读满意再买，一本一买、买了归你。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/books">浏览书库</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={user ? '/reader' : '/register'}>
                {user ? '我的书架' : '创建账号'}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y">
        <div className="container mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-center text-2xl font-semibold">三步开始</h2>
          <div className="mt-8 grid gap-6 text-center sm:grid-cols-3">
            {[
              ['1', '浏览 / 试读', '免费体验前几章，确定内容是否适合你。'],
              ['2', '一键购买', '单本买断，Stripe 安全支付，余额永久持有。'],
              ['3', '无缝阅读', '沉浸式阅读器，字号可调，进度跨设备同步。'],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-lg border bg-card p-6">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {n}
                </div>
                <h3 className="mt-4 font-medium">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured books */}
      {featured.length > 0 && (
        <section className="container mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">精选书单</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/books">查看全部 →</Link>
            </Button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="border-t bg-muted/40">
        <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold">现在开始你的第一本书</h2>
          <p className="mt-2 text-muted-foreground">免费试读无需购买，喜欢再下单。</p>
          <Button asChild size="lg" className="mt-6">
            <Link href={user ? '/books' : '/register'}>
              {user ? '去书库逛逛' : '免费创建账号'}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
