import Link from 'next/link'

interface NextStep {
  label: string
  desc: string
  href: string
}

interface Props {
  steps: NextStep[]
}

export default function NextStepBar({ steps }: Props) {
  return (
    <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
      <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-3">下一步</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {steps.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group"
          >
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 mb-0.5">
              {s.label} →
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
