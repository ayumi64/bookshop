/**
 * Central runtime configuration (single source of truth).
 * Values come from env vars; trial constants and polling thresholds are
 * configurable here (PRD §9.3 Q4/Q5) instead of scattered in code.
 */

export const SITE = {
  name: 'BookShop',
  tagline: '沉浸阅读 · 买断拥有',
  // Must be reachable for Stripe/Resend redirects. Falls back to localhost.
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;

/** Currency for Stripe & pricing. Default USD (PRD Q1). */
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'usd';

/**
 * Stripe Checkout success/cancel URL templates.
 * `{slugs}` and `{book}` are replaced in lib/stripe.ts at call time.
 */
export const CHECKOUT = {
  successPath: (slug: string) => `/reader/${slug}`,
  cancelPath: (slug: string) => `/books/${slug}`,
} as const;

/**
 * 回跳轮询 (PRD §9.3 Q4): webhook 通常晚于回跳落库。
 * 在 timeoutMs 内轮询 maxAttempts-1 次后仍失败，则引导用户手动重试/去书架。
 */
export const UNLOCK_POLLING = {
  timeoutMs: 5000,
  intervalMs: 1800, // 5s / ~2.5 次，达到 AC-P4 "5s 内 2–3 次"
  maxAttempts: 3,
} as const;

/**
 * 试读策略 (PRD §9.3 Q5 / FR-B-03 / FR-R-06):
 * 前 trialChapters 章 或 前 trialPercent%，取较小者。
 */
export const TRIAL = {
  trialChapters: 2,
  trialPercent: 10,
} as const;

/** Reader font size range (PRD FR-R-02: 16–24px, step 2). */
export const READER_FONT = {
  min: 16,
  max: 24,
  step: 2,
  default: 18,
} as const;

/** Reading progress autosave debounce (PRD FR-R-04 / AC-R3: 800ms). */
export const PROGRESS_DEBOUNCE_MS = 800;

/** Max body width for reader prose (PRD FR-R-02 / AC-R2: ~720px). */
export const READER_MAX_WIDTH = 'max-w-[720px]';

/** App roles: admin emails as a comma-separated env list. */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
