'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/books', label: '书库 Books' },
  { href: '/pricing', label: '定价 Pricing' },
];

export function SiteNavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)} aria-label="主导航">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
      <span className="font-semibold text-foreground">BookShop</span>
    </Link>
  );
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '浅色模式' : '深色模式'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
