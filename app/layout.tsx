import type { Metadata } from 'next';
import { Inter, Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { SITE } from '@/lib/config';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const serif = Noto_Serif_SC({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — 在线书店 + 阅读器`,
    template: `%s · ${SITE.name}`,
  },
  description: '极简付费电子书店 + Web 沉浸阅读器：浏览 → 试读 → 买断解锁 → 多端续读。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <ThemeProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
