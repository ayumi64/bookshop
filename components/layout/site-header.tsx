import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Logo, SiteNavLinks, ThemeToggle } from '@/components/layout/site-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import { isAdminEmail } from '@/lib/config';

export async function SiteHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-6">
          <Logo />
          <SiteNavLinks className="hidden sm:flex" />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <UserMenu email={user.email ?? ''} />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">登录</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">注册</Link>
              </Button>
            </>
          )}
          {user?.email && isAdminEmail(user.email) && (
            <Button asChild variant="outline" size="sm" className="ml-1">
              <Link href="/admin">管理</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
