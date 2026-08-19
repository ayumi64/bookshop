import { Resend } from 'resend';
import { SITE } from '@/lib/config';

/**
 * Email layer (PRD §5.6 / §8.6 AC-E*). Resend is used for welcome and
 * password-reset emails. Sending is best-effort: failures are logged and are
 * never allowed to block the primary flow (AC-E3). When no RESEND_API_KEY is
 * configured (e.g. local dev), we skip silently and log.
 */

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const FROM = process.env.RESEND_FROM || 'BookShop <onboarding@resend.dev>';

interface SendParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function sendMail({ to, subject, text, html }: SendParams): Promise<void> {
  const resend = client();
  if (!resend) {
    console.warn('[mail] RESEND_API_KEY not set; skipping email to', to, '–', subject);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, text, html });
    if (error) {
      console.error('[mail] Resend send error:', error.message);
    }
  } catch (err) {
    console.error('[mail] Resend exception:', err);
  }
}

/** Welcome email (FR-A-05 / AC-A2 / AC-E1). Does not block signup. */
export async function sendWelcomeEmail(to: string, displayName?: string) {
  const name = displayName || 'reader';
  const base = SITE.url;
  const html = `
  <div style="font-family:system-ui,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto">
    <h2 style="margin-bottom:8px">欢迎来到 ${SITE.name} 👋</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>你的账号已创建。精选书目，买断拥有，随时多设备续读。</p>
    <p style="margin:24px 0">
      <a href="${base}/books"
         style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">
        开始阅读
      </a>
    </p>
    <p style="color:#5c5c5c;font-size:13px">仅限个人阅读、禁止再分发。如需帮助，请直接回复本邮件。</p>
  </div>`;
  await sendMail({
    to,
    subject: `欢迎来到 ${SITE.name}`,
    text: `欢迎来到 ${SITE.name}。你的账号已创建：${base}/books`,
    html,
  });
}

/** Password-reset email (FR-A-03 / AC-A4 / AC-E2). Contains a safe link. */
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const html = `
  <div style="font-family:system-ui,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto">
    <h2 style="margin-bottom:8px">重置你的密码</h2>
    <p>我们收到了重置密码的请求。点击下方按钮设置新密码（链接安全且有时效）：</p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(resetLink)}"
         style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">
        重置密码
      </a>
    </p>
    <p style="color:#5c5c5c;font-size:13px">若并非你本人的操作，请忽略此邮件，你的密码不会改变。此链接会在使用后失效。</p>
  </div>`;
  await sendMail({
    to,
    subject: `${SITE.name} — 重置密码`,
    text: `重置你的密码：${resetLink}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
