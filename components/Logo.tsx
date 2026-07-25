import Link from 'next/link'

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="13" fill="#059669" />
        <polyline points="8,14.5 12,18.5 20,10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-xl font-semibold">OfferHelper</span>
    </Link>
  )
}
