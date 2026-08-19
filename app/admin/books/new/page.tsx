import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/lib/auth';
import { createBook } from '@/app/admin/actions';
import { BookForm } from '@/components/admin/book-form';
import { ChevronLeft } from 'lucide-react';

export const metadata: Metadata = { title: '上架新书' };

/**
 * Admin 上架入口 (AC-M2). Uploads cover to Storage, sets trial threshold,
 * sets status (draft/published). Submission handled by createBook Server Action.
 */
export default async function AdminNewBookPage() {
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect('/books');

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/admin/books"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> 返回图书管理
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">上架新书</h1>
      <p className="mt-1 text-muted-foreground">
        填写书籍元数据、封面上传、试读阈值与正文。保存为「已上架」即在前台可见。
      </p>
      <div className="mt-6">
        <BookForm action={createBook} submitLabel="上架图书" />
      </div>
    </div>
  );
}
