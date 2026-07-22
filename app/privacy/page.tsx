import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">← 返回首页</Link>
      </header>

      <h1 className="text-2xl font-bold mb-2">隐私政策</h1>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-8">最后更新：2026 年 7 月</p>

      <div className="space-y-6 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">我们收集哪些数据</h2>
          <p>使用 OfferHelper 时，我们会收集以下信息：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>你上传或粘贴的简历文本和 JD 内容</li>
            <li>你在面试训练和优势挖掘中的回答记录</li>
            <li>账户信息（邮箱地址）</li>
            <li>使用次数统计（用于限额管理）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">我们如何使用数据</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>简历和 JD 内容仅用于生成 AI 分析建议，不会用于训练模型</li>
            <li>分析记录保存在你的账户中，仅你本人可见</li>
            <li>我们不会向第三方出售或共享你的个人数据</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">第三方服务</h2>
          <p>OfferHelper 使用以下第三方服务处理数据：</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Supabase</strong>：用于账户认证和数据存储</li>
            <li><strong>AI 服务商</strong>（硅基流动等）：用于生成分析内容，简历文本会发送至 AI 服务商处理</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">数据安全</h2>
          <p>我们采用行业标准的安全措施保护你的数据。如果你使用自己的 API Key，Key 会加密存储。</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">你的权利</h2>
          <p>你可以随时删除自己的记录，或联系我们删除账户数据：<a href="mailto:xinyuzhang9055@163.com" className="underline">xinyuzhang9055@163.com</a></p>
        </section>
      </div>
    </main>
  )
}
