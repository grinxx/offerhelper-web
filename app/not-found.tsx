import Link from 'next/link'
import Logo from '@/components/Logo'

export default function NotFound() {
  return (
    <main className="w-full px-4 py-10 max-w-lg mx-auto min-h-screen flex flex-col justify-center">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="space-y-4">
        <p className="text-6xl font-bold text-zinc-200 dark:text-zinc-700">404</p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">页面不存在</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
          你访问的页面不存在，可能已被移动或删除。
        </p>
      </div>

      <div className="mt-10 space-y-3">
        <Link
          href="/"
          className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          返回首页
        </Link>
        <Link
          href="/dashboard"
          className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          我的记录
        </Link>
      </div>
    </main>
  )
}
