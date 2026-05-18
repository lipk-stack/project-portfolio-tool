interface ProgressProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'auto'
  showLabel?: boolean
  className?: string
}

export default function Progress({ value, max = 100, size = 'md', color = 'blue', showLabel, className = '' }: ProgressProps) {
  const pct = Math.min(Math.round((value / max) * 100), 100)

  const autoColor = pct >= 80 ? 'green' : pct >= 50 ? 'blue' : pct >= 30 ? 'yellow' : 'red'
  const effectiveColor = color === 'auto' ? autoColor : color

  const barColors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }

  const sizeClasses = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[effectiveColor]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-gray-500 font-medium w-8 text-right">{pct}%</span>}
    </div>
  )
}
