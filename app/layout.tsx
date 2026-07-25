import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OfferHelper — 把真实经历变成可投递的简历',
  description: '面向应届生的证据驱动求职工具，不编造，不包装，只优化表达。提供简历优化、岗位匹配、面试训练、优势挖掘四大功能。',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  themeColor: '#059669',
  openGraph: {
    title: 'OfferHelper — 把真实经历变成可投递的求职材料',
    description: '不编造，不包装，只优化表达。简历优化、岗位匹配、面试训练、优势挖掘，一站式求职准备工具。',
    url: 'https://offerhelper.cloud',
    siteName: 'OfferHelper',
    images: [{ url: 'https://offerhelper.cloud/og', width: 1200, height: 630 }],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OfferHelper — 把真实经历变成可投递的求职材料',
    description: '不编造，不包装，只优化表达。',
    images: ['https://offerhelper.cloud/og'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark:[color-scheme:dark] min-h-full" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 min-h-full pb-safe`}>
        <Providers>{children}</Providers>
        <Analytics />
        <Script id="baidu-analytics" strategy="afterInteractive">
          {`
            var _hmt = _hmt || [];
            (function() {
              var hm = document.createElement("script");
              hm.src = "https://hm.baidu.com/hm.js?016aac05529a6ef802c2e17e82e9bc94";
              var s = document.getElementsByTagName("script")[0];
              s.parentNode.insertBefore(hm, s);
            })();
          `}
        </Script>
      </body>
    </html>
  )
}
