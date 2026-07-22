import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">← 返回首页</Link>
      </header>

      <h1 className="text-2xl font-bold mb-2">服务条款</h1>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-8">最后更新：2026 年 7 月</p>

      <div className="space-y-6 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">服务说明</h2>
          <p>OfferHelper 是一个面向应届生和在校生的求职辅助工具，提供简历优化、岗位匹配、面试训练和优势挖掘功能。所有分析结果由 AI 生成，仅供参考。</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">使用规范</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>请勿上传他人的简历或未经授权的内容</li>
            <li>请勿使用自动化工具批量调用接口</li>
            <li>请勿将分析结果用于商业目的或转售</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">免责声明</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>AI 生成的内容仅供参考，不构成任何职业建议或录用承诺</li>
            <li>我们不对因使用本服务导致的求职结果负责</li>
            <li>服务按「现状」提供，我们不保证 100% 可用性</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">账户</h2>
          <p>你对账户内的所有活动负责。如发现账户被盗用，请立即联系我们：<a href="mailto:xinyuzhang9055@163.com" className="underline">xinyuzhang9055@163.com</a></p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">条款变更</h2>
          <p>我们可能更新服务条款，更新后继续使用即视为同意新条款。</p>
        </section>
      </div>
    </main>
  )
}
