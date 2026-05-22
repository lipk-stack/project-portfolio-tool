interface SkeletonProps {
  className?: string
  height?: string
  width?: string
  rounded?: boolean
}

export function Skeleton({ className = '', height = 'h-4', width = 'w-full', rounded = false }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 ${height} ${width} ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 space-y-3 ${className}`}>
      <Skeleton height="h-5" width="w-2/3" />
      <Skeleton height="h-3" width="w-full" />
      <Skeleton height="h-3" width="w-4/5" />
      <div className="pt-2">
        <Skeleton height="h-8" width="w-1/3" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="h-3" width={i === 0 ? 'w-1/3' : 'w-1/6'} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 px-4 py-3 border-b last:border-0">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} height="h-4" width={colIdx === 0 ? 'w-1/3' : 'w-1/6'} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton height="h-7" width="w-64" />
          <Skeleton height="h-4" width="w-48" />
        </div>
        <Skeleton height="h-9" width="w-36" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-3">
          <Skeleton height="h-6" width="w-48" />
          <SkeletonTable rows={6} cols={5} />
        </div>
        <div className="col-span-4 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}
