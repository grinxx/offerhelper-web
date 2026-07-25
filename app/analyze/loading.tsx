export default function Loading() {
  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="h-7 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-5 w-40 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="mb-6 space-y-2">
        <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="space-y-4">
        <div className="h-40 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-40 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>
    </main>
  )
}
