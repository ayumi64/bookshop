import Link from 'next/link';
import { isCurrentUserAdmin } from '@/lib/auth';
import { Button } from '@/components/ui/button';

/**
 * Admin area layout (AC-M1) — consistent nav across admin pages. Middleware and
 * each page already enforce the admin check; this adds a top nav only.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isCurrentUserAdmin();

  return (
    <div className="min-h-screen bg-background">
      {admin && (
        <header className="border-b bg-muted/40">
          <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 px-4">
            <Link href="/admin" className="text-sm font-semibold hover:underline">
              Admin
            </Link>
            <nav className="flex items-center gap-1 text-sm" aria-label="管理后台导航">
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/books">图书</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/purchases">订单</Link>
              </Button>
            </nav>
            <div className="ml-auto">
              <Button asChild variant="ghost" size="sm">
                <Link href="/books">查看前台 →</Link>
              </Button>
            </div>
          </div>
        </header>
      )}
      {children}
    </div>
  );
}
