import type { Metadata } from 'next';

export const metadata: Metadata = { title: '隐私政策' };

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 prose prose-neutral">
      <h1>隐私政策</h1>
      <p className="text-sm text-muted-foreground">最后更新：2026-08</p>
      <h2>我们收集什么</h2>
      <p>账号基础信息：邮箱、显示名、密码（经 Supabase Auth 安全哈希存储）。阅读进度、购买记录仅用于提供书店与阅读器服务。</p>
      <h2>我们如何使用</h2>
      <p>用于账号登录、解锁权益、同步阅读进度、发送欢迎/重置邮件、处理支付与退款。我们不向第三方出售个人信息。</p>
      <h2>支付</h2>
      <p>支付由 Stripe 托管处理，我们不接触你的卡号（PCI-DSS 合规由 Stripe 保障）。</p>
      <h2>你的权利</h2>
      <p>你可随时联系管理员导出或删除账号数据；删除账号将同时删除购买/进度记录，已购内容将无法继续访问。</p>
    </div>
  );
}
