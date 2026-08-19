'use client';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary for the reader shelf (AC-N5).
 */
export default function ReaderShelfError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <h2 className="text-lg font-semibold">书架加载失败</h2>
      <p className="mt-2 text-sm text-muted-foreground">暂时无法加载你的书架，请稍后重试。</p>
      {error?.digest && <p className="mt-1 text-xs text-muted-foreground/70">错误标识：{error.digest}</p>}
      <Button className="mt-6" onClick={reset}>重试</Button>
    </div>
  );
}
