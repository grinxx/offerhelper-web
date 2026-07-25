import Link from 'next/link'

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{background:'#4F46E5'}}>
        <svg viewBox="0 0 32 32" className="w-4 h-4">
          <polyline points="8,17 13,22 24,11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </span>
      <span className="text-xl font-semibold">OfferHelper</span>
    </Link>
  )
}
