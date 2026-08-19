'use client';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary for the reading view (AC-N5).
 * Retry re-renders the same URL; a back-to-bookshelf escape is also offered
 * so the reader never dead-ends on a white screen.
 */
export default function ReaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <h2 className="text-lg font-semibold">阅读器加载失败</h2>
      <p className="mt-2 text-sm text-muted-foreground">暂时无法载入本章，请稍后重试。</p>
      {error?.digest && <p className="mt-1 text-xs text-muted-foreground/70">错误标识：{error.digest}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>重试</Button>
        <Button variant="ghost" onClick={() => window.location.assign('/reader')}>返回我的书架</Button>
      </div>
    </div>
  );
}
