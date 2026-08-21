/**
 * Content compliance — Phase 2 Reviews (FR-RR-32 / FR-RR-33 / N-RR-03).
 *
 * A pragmatic first line of defense applied server-side at submission time:
 *  - block URLs / external links (http(s)://, www., bare domains)
 *  - block a small set of egregious abusive words (辱骂)
 * Keep it conservative — normal Chinese content must not be harmed (FR-RR-33).
 * Full moderation is out of scope this phase (reserved table + report entry
 * for ops follow-up).
 */

/** Detect external links in user text. Returns true when a URL is present. */
export function containsUrl(text: string): boolean {
  return /(?:https?:\/\/|www\.)[^\s]+/i.test(text);
}

/** Egregious abusive tokens (basic slang filter). Covers worst cases only. */
const ABUSIVE = [
  '妈的', '卧槽', '操你', '傻逼', '煞笔', '去死', 'nmsl', 'cnm', 'sb',
];

/** Detect any configured abusive token (case-insensitive). */
export function containsAbusive(text: string): boolean {
  const lowered = text.toLowerCase();
  return ABUSIVE.some((t) => lowered.includes(t.toLowerCase()));
}

/** Run both checks; returns a suggested user-facing reason (may be one). */
export function complianceViolation(text: string): string | null {
  if (containsUrl(text)) {
    return '短评不能包含外部链接（URL）。';
  }
  if (containsAbusive(text)) {
    return '短评包含不适宜内容，请修改后提交。';
  }
  return null;
}

/** Normalize input before storing: trim/collapse whitespace. */
export function normalizeContent(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
