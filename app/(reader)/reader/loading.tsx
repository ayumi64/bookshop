import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading state for the reader shelf / my-bookshelf (AC-N5).
 */
export default function ReaderShelfLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8" aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-5 w-64" />
      <div className="mt-6 space-y-10">
        {[0, 1].map((s) => (
          <section key={s}>
            <Skeleton className="h-6 w-20" />
            <div className="mt-3 grid grid-cols-1 gap-4 bp480:grid-cols-2 bp780:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-1/2" />
                  <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
