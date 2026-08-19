import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export const metadata: Metadata = { title: '定价' };

// Static single-book pricing explained here for transparency. Actual per-book
// prices come from the books data source (single source of truth), but FAQ /
// refund policy live here.
const samplePrice = formatPrice(299, 'usd');

const faqs = [
  {
    q: '我买的是什么？',
    a: '单本买断授权。一次购买，永久持有该书，可在多设备续读，无需订阅。',
  },
  {
    q: '可以试读吗？',
    a: '可以。每本书都可免费试读前 2 章或前 10%（取较小者），满意再购买。',
  },
  {
    q: '购买后在哪里阅读？',
    a: '登录后进入「我的书架」即可在任何设备继续阅读，进度会同步。',
  },
  {
    q: '可以退款吗？',
    a: `本平台内容一经购买即锁定；若购买后该书存在重大质量/技术问题，请通过页面底部联系方式联系我们，7 天内可申请退款（最终以支付渠道规则为准）。`,
  },
];

export default function PricingPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold">简单透明的定价</h1>
        <p className="mt-2 text-muted-foreground">按本购买，不强制订阅，买断拥有。</p>
      </header>

      <section className="mt-10" aria-label="定价方案">
        <Card className="mx-auto max-w-md border-primary/40">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">单本购买</CardTitle>
            <p className="text-muted-foreground">适合只想买几本好书的读者</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center">
              <span className="text-4xl font-semibold">{samplePrice}</span>
              <span className="text-muted-foreground"> / 本起</span>
            </p>
            <ul className="space-y-2 text-sm">
              {[
                '免费试读前 2 章 / 前 10%',
                '一次买断、永久持有',
                '无限次重读',
                '多设备同步阅读进度',
                '沉浸式阅读器（字号 / 深色模式可调）',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full" size="lg">
              <Link href="/books">去书库选择</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12" aria-label="常见问题">
        <h2 className="mb-4 text-2xl font-semibold">常见问题</h2>
        <div className="divide-y rounded-lg border">
          {faqs.map((f, i) => (
            <details key={i} className="group p-4">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-lg border bg-muted/40 p-6" aria-label="退款政策">
        <h2 className="text-lg font-semibold">退款政策摘要</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          公版 / 自有授权内容，以「买断」为主。若购买的书籍存在重大质量或技术问题，7 天内可联系我们申请退款；
          内容一旦完整阅读或属于恶意退款情形，平台可拒绝并在第 2 次起审核。退款处理最终遵循支付渠道（Stripe）规则。
        </p>
      </section>
    </div>
  );
}
