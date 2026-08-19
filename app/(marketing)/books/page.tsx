import { Metadata } from 'next';
import { listBooksWithPurchase } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { BookGridWithFilters } from '@/components/books/book-grid';

export const metadata: Metadata = { title: '书库' };

export default async function BooksPage() {
  const { user } = await getCurrentUser();
  const books = await listBooksWithPurchase(user?.id);

  const categories = Array.from(
    new Set(books.map((b) => b.category).filter((c): c is string => !!c)),
  ).sort();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">书库</h1>
        <p className="mt-1 text-muted-foreground">精选公版 / 自有授权内容，买断拥有，多端续读。</p>
      </header>
      <BookGridWithFilters books={books} categories={categories} />
    </div>
  );
}
