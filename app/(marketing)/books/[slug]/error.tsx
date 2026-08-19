'use client';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary for the book detail page (AC-N5).
 */
export default function BookDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <h2 className="text-lg font-semibold">详情加载失败</h2>
      <p className="mt-2 text-sm text-muted-foreground">暂时无法加载本书详情，请稍后重试。</p>
      {error?.digest && <p className="mt-1 text-xs text-muted-foreground/70">错误标识：{error.digest}</p>}
      <Button className="mt-6" onClick={reset}>重试</Button>
    </div>
  );
}
