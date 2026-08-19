import type { Metadata } from 'next';

export const metadata: Metadata = { title: '使用条款' };

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 prose prose-neutral">
      <h1>使用条款</h1>
      <p className="text-sm text-muted-foreground">最后更新：2026-08</p>
      <h2>内容授权</h2>
      <p>平台仅供公版 / 自有授权内容。购买授予的是个人阅读授权，仅限个人使用，禁止再分发、转载、用于 AI 训练或商业用途。</p>
      <h2>购买与退款</h2>
      <p>买断型购买。退款政策见定价页摘要，最终遵循支付渠道规则。</p>
      <h2>账号安全</h2>
      <p>你需妥善保管登录凭据；账号被用于违规行为可能导致内容访问权被撤销。</p>
      <h2>免责</h2>
      <p>平台尽力保障可用性，但因维护、升级或不可抗力导致的临时不可用不构成退款理由。</p>
    </div>
  );
}
