import { TRIAL } from '@/lib/config';
import type { Chapter } from '@/lib/types';

/**
 * Trial boundary helper (PRD §9.3 Q5 / FR-B-03): a chapter is "free to read"
 * for unauthenticated / non-purchased users when it is within the first
 * `trialChapters` chapters OR the first `trialPercent`% of chapters,
 * whichever boundary is SMALLER (i.e. fewer free chapters wins).
 *
 * Example: 12 chapters, trial_chapters=2, trial_percent=10 → 10% of 12 = 1.2
 * → min(2, 1) = 1 → only chapter #1 is trial.  (matches PRD "取较小者")
 */
export function isTrialChapter(
  chapter: Pick<Chapter, 'sort_order' | 'is_trial'>,
  opts: { trialChapters?: number; trialPercent?: number; totalChapters: number },
): boolean {
  if (chapter.is_trial) return true;
  const byCount =
    chapter.sort_order <= (opts.trialChapters ?? TRIAL.trialChapters);
  const percent = opts.trialPercent ?? TRIAL.trialPercent;
  const byPercent = chapter.sort_order <= Math.floor((percent * opts.totalChapters) / 100);
  return byCount && byPercent;
}

/** True when the reader has reached / passed the end of the trial range. */
export function reachedTrialEnd(
  currentSort: number,
  opts: { trialChapters?: number; trialPercent?: number; totalChapters: number },
): boolean {
  return !isTrialChapter({ sort_order: currentSort, is_trial: false }, opts);
}

/**
 * Text used inside the reader paywall: remaining chapters and read %.
 * (PRD FR-R-06: "剩余 N 章 / 已读 X%")
 */
export function trialWallCopy(
  currentSort: number,
  totalChapters: number,
  opts?: { trialChapters?: number; trialPercent?: number },
) {
  const trialEnd = isTrialChapter(
    { sort_order: totalChapters, is_trial: false },
    { totalChapters, ...opts },
  )
    ? totalChapters
    : Math.floor(((opts?.trialPercent ?? TRIAL.trialPercent) * totalChapters) / 100);
  const remaining = Math.max(0, totalChapters - trialEnd);
  const readPercent = Math.min(
    100,
    Math.round((currentSort / Math.max(1, totalChapters)) * 100),
  );
  return { remaining, readPercent, trialEnd };
}
