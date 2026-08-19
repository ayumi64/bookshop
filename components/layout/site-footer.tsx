import Link from 'next/link';
import { SITE } from '@/lib/config';

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">{SITE.name}</p>
            <p className="mt-1">本平台仅提供公版 / 自有授权内容 · 仅限个人阅读、禁止再分发</p>
          </div>
          <nav aria-label="页脚导航" className="flex flex-wrap gap-4">
            <Link className="hover:text-foreground" href="/books">书库</Link>
            <Link className="hover:text-foreground" href="/pricing">定价</Link>
            <Link className="hover:text-foreground" href="/privacy">隐私</Link>
            <Link className="hover:text-foreground" href="/terms">条款</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
