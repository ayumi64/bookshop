import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { updateBook } from '@/app/admin/actions';
import { BookForm } from '@/components/admin/book-form';
import { ChevronLeft } from 'lucide-react';
import type { Book } from '@/lib/types';

export const metadata: Metadata = { title: '编辑图书' };

/**
 * Admin edit page (AC-M2). Loads a book by id (any status) and pre-fills the
 * form. Submission goes through the updateBook Server Action.
 */
export default async function AdminEditBookPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect('/books');

  const supabase = createServiceClient();
  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!book) notFound();
  const b = book as Book;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/admin/books"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> 返回图书管理
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">编辑：{b.title}</h1>
      <p className="mt-1 text-muted-foreground">修改后点击保存，前台即时反映状态变化。</p>
      <div className="mt-6">
        <BookForm
          action={updateBook}
          submitLabel="保存修改"
          initial={{
            id: b.id,
            slug: b.slug,
            title: b.title,
            author: b.author ?? '',
            category: b.category ?? '',
            blurb: b.blurb ?? '',
            price_cents: String(b.price_cents),
            currency: b.currency,
            cover_url: b.cover_url ?? '',
            body_location: b.body_location ?? '',
            trial_chapters: String(b.trial_chapters),
            trial_percent: String(b.trial_percent),
            status: b.status,
          }}
        />
      </div>
    </div>
  );
}
