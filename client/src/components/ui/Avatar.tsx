interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: string
  className?: string
}

const colors = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
]

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

export default function Avatar({ name, size = 'md', color, className = '' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const bgColor = color || getColor(name)
  return (
    <div className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}>
      {initials}
    </div>
  )
}

export function AvatarGroup({ names, max = 3 }: { names: string[]; max?: number }) {
  const visible = names.slice(0, max)
  const rest = names.length - max
  return (
    <div className="flex -space-x-2">
      {visible.map((name, i) => (
        <div key={i} className="ring-2 ring-white rounded-full" title={name}>
          <Avatar name={name} size="sm" />
        </div>
      ))}
      {rest > 0 && (
        <div className="w-7 h-7 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-xs font-semibold text-gray-600">
          +{rest}
        </div>
      )}
    </div>
  )
}
