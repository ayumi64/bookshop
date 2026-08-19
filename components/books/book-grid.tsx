'use client';

import { useMemo, useState } from 'react';
import type { BookWithPurchase } from '@/lib/types';
import { BookCard } from '@/components/books/book-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

type PriceFilter = 'all' | 'free' | 'paid' | 'purchased';

export function BookGridWithFilters({
  books,
  categories,
}: {
  books: BookWithPurchase[];
  categories: string[];
}) {
  const [category, setCategory] = useState<string>('all');
  const [price, setPrice] = useState<PriceFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return books.filter((b) => {
      if (category !== 'all' && b.category !== category) return false;
      if (price === 'free' && b.price_cents !== 0) return false;
      if (price === 'paid' && (b.price_cents <= 0 || b.purchased)) return false;
      if (price === 'purchased' && !b.purchased) return false;
      const q = query.trim().toLowerCase();
      if (q && !`${b.title} ${b.author ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [books, category, price, query]);

  const hasSearchOrFilter = query.trim() !== '' || category !== 'all' || price !== 'all';

  return (
    <div>
      <form
        className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
        role="search"
        aria-label="筛选书库"
      >
        <div className="sm:col-span-2">
          <Label htmlFor="book-search" className="sr-only">搜索书名或作者</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="book-search"
              type="search"
              placeholder="搜索书名或作者…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="category-filter" className="sr-only">按分类筛选</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category-filter" aria-label="按分类筛选">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="price-filter" className="sr-only">按价格筛选</Label>
          <Select value={price} onValueChange={(v) => setPrice(v as PriceFilter)}>
            <SelectTrigger id="price-filter" aria-label="按价格筛选">
              <SelectValue placeholder="全部价格" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部价格</SelectItem>
              <SelectItem value="free">免费</SelectItem>
              <SelectItem value="paid">付费</SelectItem>
              <SelectItem value="purchased">已购</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          {hasSearchOrFilter ? (
            <>
              <p className="font-medium">未找到相关书籍</p>
              <p className="mt-1 text-sm text-muted-foreground">试试调整筛选或搜索词。</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setQuery(''); setCategory('all'); setPrice('all'); }}
              >
                清除筛选
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">书库正在上新，敬请期待。</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 bp480:grid-cols-2 bp780:grid-cols-3">
          {filtered.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
