// Shown by Next.js App Router while the async page fetches data
export default function Loading() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Loading…">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-80 animate-pulse rounded bg-gray-100" />
      </div>

      {/* Content skeleton */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading, please wait</span>
      </div>
    </div>
  );
}
