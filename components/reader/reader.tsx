'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Book, Chapter } from '@/lib/types';
import { READER_FONT, PROGRESS_DEBOUNCE_MS, UNLOCK_POLLING } from '@/lib/config';
import { trialWallCopy } from '@/lib/trial';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2, BookOpen, Save, Check, Circle, Minus, Sun, Moon } from 'lucide-react';
import { PurchaseButton } from '@/components/books/purchase-button';
import { cn } from '@/lib/utils';

interface ReaderChapter extends Chapter {
  content: string | null; // null when not authorized at the DB layer
}

export interface ReaderInit {
  book: Book;
  chapters: ReaderChapter[];
  purchased: boolean;
  totalChapters: number;
  initialChapterSlug: string | null;
  initialParagraphId: string | null;
  initialPercent: number | null;
  isLoggedIn: boolean;
  trialOverride?: boolean; // ?trial=1 forces entry into first trial chapter
}

/**
 * Immersive reader (PRD §5.5 / AC-R*).
 * - font size A-/A+ 16..24, persisted; line-height≥1.6; body ≤720px
 * - progress autosave debounced 800ms, status "已保存"
 * - chapter nav: dropdown + prev/next + keyboard ←/→
 * - paid wall (inline) for non-purchasers at trial end (AC-R7)
 * - deep/sepia theme, persisted
 * - checkout-return polling (AC-P4)
 */
export function Reader({
  book,
  chapters,
  purchased: initialPurchased,
  totalChapters,
  initialChapterSlug,
  initialParagraphId,
  initialPercent,
  isLoggedIn,
  trialOverride,
}: ReaderInit) {
  const router = useRouter();

  // ---- state ----
  const [purchased, setPurchased] = useState(initialPurchased);
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window === 'undefined') return READER_FONT.default;
    const v = Number(localStorage.getItem('reader-fontsize') || READER_FONT.default);
    return Math.min(READER_FONT.max, Math.max(READER_FONT.min, v));
  });
  const [readerTheme, setReaderTheme] = useState<'light' | 'dark' | 'sepia'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('reader-theme') as 'light' | 'dark' | 'sepia') || 'light';
  });
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockTimedOut, setUnlockTimedOut] = useState(false);

  const order = useMemo(() => [...chapters].sort((a, b) => a.sort_order - b.sort_order), [chapters]);

  const [current, setCurrent] = useState<ReaderChapter>(() => {
    // entry chapter: initial if it exists, else fall back to first readable.
    if (initialChapterSlug) {
      const found = order.find((c) => c.slug === initialChapterSlug);
      if (found) return found;
    }
    if (trialOverride) {
      return order[0];
    }
    // prefer saved/initial; else first chapter with readable content (trial or full)
    return order.find((c) => c.content !== null) ?? order[0];
  });
  const currentIndex = order.findIndex((c) => c.id === current.id);

  // per-paragraph scroll tracking
  const bodyRef = useRef<HTMLElement>(null);
  const paragraphElements = useRef<Map<string, HTMLElement>>(new Map());
  const [activeParagraph, setActiveParagraph] = useState<string | null>(null);
  const [resumedFrom, setResumedFrom] = useState<string | null>(
    initialParagraphId && !trialOverride ? '上次读到' : null,
  );

  // ---- theme class ----
  const themeClass =
    readerTheme === 'dark' ? 'dark' : readerTheme === 'sepia' ? 'reader-sepia' : '';

  useEffect(() => {
    localStorage.setItem('reader-fontsize', String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem('reader-theme', readerTheme);
  }, [readerTheme]);

  // ---- autosave ----
  const pendingSave = useRef({ bookId: book.id, chapterSlug: current.slug, paragraphId: null as string | null, percent: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AC-R8: offline save is buffered here so it can flush when connectivity returns.
  const offlinePendingSave = useRef<{
    bookId: string;
    chapterSlug: string;
    paragraphId: string | null;
    percent: number;
  } | null>(null);

  const persist = useCallback(async () => {
    if (!isLoggedIn) return;
    // If a save is already queued while offline, merge the newest position into it.
    const payload = offlinePendingSave.current ?? pendingSave.current;
    try {
      const res = await fetch('/api/reader/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'save failed');
      }
      offlinePendingSave.current = null; // flushed successfully
      setSavedFlash(true);
      setSaveError(null);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch (e) {
      // Offline / transient: buffer for retry once back online (AC-R8).
      offlinePendingSave.current = payload;
      setSaveError(e instanceof Error ? e.message : '保存失败');
    }
  }, [isLoggedIn]);

  const maybeSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const anchor = currentParagraphThunk();
    pendingSave.current = { bookId: book.id, chapterSlug: current.slug, paragraphId: anchor, percent: currentPercentThunk() };
    setSaveError(null);
    saveTimer.current = setTimeout(persist, PROGRESS_DEBOUNCE_MS);
  }, [book.id, current.slug, persist]);

  // AC-R8: flush buffered offline progress when connectivity returns.
  useEffect(() => {
    function onOnline() {
      if (offlinePendingSave.current && isLoggedIn) {
        void persist();
      }
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [isLoggedIn, persist]);
  // Helper accessors that read from DOM at call time (stable for debounce).
  function currentParagraphThunk(): string | null {
    return activeParagraph;
  }
  // Real percent: base = fraction across chapters, plus a small intra-chapter offset
  // from the active paragraph position, clamped to 0-100. Never divides by zero.
  function currentPercentThunk(): number {
    if (totalChapters <= 0) return 0;
    const base = (currentIndex / totalChapters) * 100;
    let offset = 0;
    if (activeParagraph && order[currentIndex] && order[currentIndex].content) {
      const paras = order[currentIndex].content.split('\n').filter((p) => p.trim() !== '');
      const found = paras.findIndex((p, k) => `${order[currentIndex].slug}-p${k}` === activeParagraph);
      if (found >= 0 && paras.length > 1) {
        // approximate within-chapter position (0..~99%) just before the next chapter
        offset = (found / (paras.length - 1)) * (100 / totalChapters);
      }
    }
    return Math.min(100, Math.round(base + offset));
  }

  // ---- real percent helper (percent = chapter index fraction + anchor offset) ----
  const computePercent = useCallback((chIndex: number): number => {
    if (totalChapters <= 0) return 0;
    const base = (chIndex / totalChapters) * 100;
    return Math.min(100, Math.round(base));
  }, [totalChapters]);

  // Replace percent thunks with deterministic compute:
  const realPercent = computePercent(currentIndex);

  // ---- scrolling ----
  useEffect(() => {
    // Restore to the saved paragraph when mounted.
    if (initialParagraphId && !trialOverride) {
      scrollToParagraph(initialParagraphId);
    } else if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToParagraph(id: string) {
    const el = paragraphElements.current.get(id);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  const onScroll = useCallback(() => {
    const container = bodyRef.current;
    if (!container) return;
    // find the last paragraph whose top is above halfway, plus section highlights
    let best: string | null = null;
    let bestTop = -Infinity;
    paragraphElements.current.forEach((el, id) => {
      const top = el.getBoundingClientRect().top;
      if (top < innerHeight * 0.4 && top > bestTop) {
        bestTop = top;
        best = id;
      }
    });
    setActiveParagraph(best);
    maybeSave();
  }, [maybeSave]);

  // ---- switch chapter ----
  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= order.length) return;
      // clear debounce and persist immediately then navigate
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingSave.current = {
        bookId: book.id,
        chapterSlug: order[idx].slug,
        paragraphId: null,
        percent: computePercent(idx),
      };
      void persist();
      setCurrent(order[idx]);
      setResumedFrom(null);
      setActiveParagraph(null);
      requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
      });
    },
    [book.id, order, computePercent, persist],
  );

  // ---- keyboard nav ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if ((e.target as HTMLElement)?.getAttribute?.('role') === 'menuitem') return;
      if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
      if (e.key === 'ArrowRight') goTo(currentIndex + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, currentIndex]);

  // ---- checkout-return polling (AC-P4) ----
  useEffect(() => {
    if (purchased) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;
    setUnlocking(true);
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const res = await fetch(`/api/books/${book.slug}/unlock-status`, { cache: 'no-store' });
      const json = await res.json();
      if (json.purchased) {
        setPurchased(true);
        setUnlocking(false);
        router.refresh();
        return;
      }
      if (attempts < UNLOCK_POLLING.maxAttempts) {
        setTimeout(poll, UNLOCK_POLLING.intervalMs);
      } else {
        setUnlocking(false);
        setUnlockTimedOut(true);
      }
    };
    setTimeout(poll, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- unlock remap (AC-P2/P4): when purchased flips false→true, remap a stale
  // locked chapter (content===null) to the same-slug full chapter and restore anchor. ----
  const prevPurchasedRef = useRef(initialPurchased);
  useEffect(() => {
    const prev = prevPurchasedRef.current;
    prevPurchasedRef.current = purchased;
    if (!prev && purchased && current.content === null) {
      const remapped = order.find((c) => c.slug === current.slug);
      if (remapped) {
        const anchor = activeParagraph;
        setCurrent(remapped);
        // restore scroll to the last active paragraph on next frame
        requestAnimationFrame(() => {
          const el = anchor && paragraphElements.current.get(anchor);
          if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchased, order, current]);

  // ---- paid wall ----
  const trialCopy = trialWallCopy(currentIndex + 1, totalChapters, {
    trialChapters: book.trial_chapters,
    trialPercent: book.trial_percent,
  });
  const isTrialChapter = current.content !== null; // readable by anon
  const showPaidWall = !purchased && !isTrialChapter;

  const atBeginning = currentIndex <= 0;
  const atEnd = currentIndex >= order.length - 1;

  return (
    <div className={`flex min-h-screen flex-col bg-reader-bg text-reader-fg ${themeClass}`}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="返回我的书架">
              <Link href="/reader"><ChevronLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <ChapterDropdown
                order={order}
                currentIndex={currentIndex}
                purchased={purchased}
                onSelect={goTo}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <FontControls fontSize={fontSize} onChange={setFontSize} />
            <ThemeSwitcher theme={readerTheme} onChange={setReaderTheme} />
            {isLoggedIn && (
              <SaveIndicator flash={savedFlash} error={saveError} />
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <article
        ref={bodyRef}
        onScroll={onScroll}
        className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto py-8 px-4"
      >
        {resumedFrom && !purchased && (
          <p className="mb-4 rounded-md bg-accent/60 px-3 py-2 text-sm text-muted-foreground">
            {resumedFrom}之前的位置
          </p>
        )}
        {resumedFrom && purchased && (
          <p className="mb-4 rounded-md bg-accent/60 px-3 py-2 text-sm text-muted-foreground">
            上次读到：{current.title}
          </p>
        )}

        <h1 className="text-2xl font-semibold" style={{ fontSize: fontSize + 5 }}>
          {current.title}
        </h1>

        {current.content ? (
          <div
            className="mt-4 space-y-4 font-serif"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
            aria-label="正文"
          >
            {current.content.split('\n').filter((p) => p.trim() !== '').map((para, i) => {
              const id = `${current.slug}-p${i}`;
              return (
                <p
                  key={id}
                  id={id}
                  data-paragraph={id}
                  ref={(el) => {
                    if (el) paragraphElements.current.set(id, el);
                    else paragraphElements.current.delete(id);
                  }}
                  className={cn(
                    'whitespace-pre-wrap rounded-sm px-0.5 transition-colors',
                    activeParagraph === id && 'bg-primary/5',
                  )}
                >
                  {para}
                </p>
              );
            })}
          </div>
        ) : (
          showPaidWall && (
            <PaidWall
              remaining={trialCopy.remaining}
              readPercent={trialCopy.readPercent}
              bookId={book.id}
              bookSlug={book.slug}
              isLoggedIn={isLoggedIn}
              unlocking={unlocking}
              unlockTimedOut={unlockTimedOut}
              onGoBooks={() => router.push('/books')}
            />
          )
        )}

        {current.content && (
          <div className="mt-10 border-t pt-4 text-center text-sm text-muted-foreground">
            —— 本章结束 ——
          </div>
        )}
      </article>

      {/* Bottom nav */}
      <footer className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goTo(currentIndex - 1)}
            disabled={atBeginning}
            aria-label="上一章"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> 上一章
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {totalChapters} · {realPercent}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goTo(currentIndex + 1)}
            disabled={atEnd}
            aria-label="下一章"
          >
            下一章 <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function FontControls({ fontSize, onChange }: { fontSize: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label="减小字号"
        disabled={fontSize <= READER_FONT.min}
        onClick={() => onChange(Math.max(READER_FONT.min, fontSize - READER_FONT.step))}
      >
        <Minus className="h-4 w-4" aria-hidden="true" /> A-
      </Button>
      <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">{fontSize}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label="增大字号"
        disabled={fontSize >= READER_FONT.max}
        onClick={() => onChange(Math.min(READER_FONT.max, fontSize + READER_FONT.step))}
      >
        A+ <PlusIcon />
      </Button>
    </div>
  );
}

function PlusIcon() {
  return <span className="text-xs">+</span>;
}

function ThemeSwitcher({
  theme,
  onChange,
}: {
  theme: 'light' | 'dark' | 'sepia';
  onChange: (t: 'light' | 'dark' | 'sepia') => void;
}) {
  const next: Record<'light' | 'dark' | 'sepia', 'light' | 'dark' | 'sepia'> = {
    light: 'dark',
    dark: 'sepia',
    sepia: 'light',
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(next[theme])}
      aria-label={`当前${theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '护眼'}模式，点击切换`}
      title={`主题：${theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '护眼'}`}
    >
      {theme === 'light' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}

function SaveIndicator({ flash, error }: { flash: boolean; error: string | null }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
      {error ? (
        <span className="text-destructive">{error}</span>
      ) : flash ? (
        <>
          <Check className="h-3 w-3 text-success" aria-hidden="true" /> 已保存
        </>
      ) : (
        <Save className="h-3 w-3" aria-hidden="true" />
      )}
    </span>
  );
}

function ChapterDropdown({
  order,
  currentIndex,
  purchased,
  onSelect,
}: {
  order: ReaderChapter[];
  currentIndex: number;
  purchased: boolean;
  onSelect: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = order[currentIndex];
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="max-w-[11rem] gap-1" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="truncate">{current?.title}</span>
        <ChevronDownIcon className="h-3 w-3" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-56 overflow-auto rounded-md border bg-popover p-1 shadow-lg" role="listbox">
          {order.map((ch, i) => {
            const locked = !purchased && ch.content === null;
            return (
              <button
                key={ch.id}
                role="option"
                aria-selected={i === currentIndex}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => { setOpen(false); onSelect(i); }}
              >
                {purchased || ch.content !== null ? (
                  i < currentIndex ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-label="已读" aria-hidden="true" />
                  ) : i === currentIndex ? (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="读中" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" aria-label="未读" aria-hidden="true" />
                  )
                ) : (
                  <LockIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="锁定" aria-hidden="true" />
                )}
                <span className="truncate">{ch.title}</span>
                {!purchased && ch.content !== null && <Badge variant="secondary" className="ml-auto shrink-0">试读</Badge>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PaidWall({
  remaining,
  readPercent,
  bookId,
  bookSlug,
  isLoggedIn,
  unlocking,
  unlockTimedOut,
  onGoBooks,
}: {
  remaining: number;
  readPercent: number;
  bookId: string;
  bookSlug: string;
  isLoggedIn: boolean;
  unlocking: boolean;
  unlockTimedOut: boolean;
  onGoBooks: () => void;
}) {
  return (
    <div className="my-8 rounded-lg border border-dashed bg-muted/40 p-6 text-center" role="region" aria-label="解锁本书">
      <p className="text-lg font-medium">试读已结束</p>
      <p className="mt-1 text-sm text-muted-foreground">
        解锁剩余 {remaining} 章即可继续阅读（你已读约 {readPercent}% 试读范围）。
      </p>
      {unlocking ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> 解锁生效中…
        </p>
      ) : unlockTimedOut ? (
        <p className="mt-4 text-sm text-destructive">
          解锁尚未生效，可稍后重试或前往我的书架查看。
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <PurchaseButton
          bookId={bookId}
          bookSlug={bookSlug}
          isLoggedIn={isLoggedIn}
          label="解锁本书"
          size="lg"
        />
        <Button variant="ghost" size="lg" onClick={onGoBooks}>查看价格</Button>
      </div>
      {!isLoggedIn && (
        <p className="mt-3 text-sm text-muted-foreground">购买前请先登录账号。</p>
      )}
    </div>
  );
}
