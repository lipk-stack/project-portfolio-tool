import { Health, Priority, ProjectStatus, TaskStatus } from '../../types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
  size?: 'sm' | 'md'
  dot?: boolean
}

const variantClasses = {
  default: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-cyan-100 text-cyan-700',
  gray: 'bg-gray-100 text-gray-600',
}

const dotColors = {
  default: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-cyan-500',
  gray: 'bg-gray-400',
}

export function Badge({ children, variant = 'default', size = 'sm', dot }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeClass} ${variantClasses[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  )
}

export function HealthBadge({ health }: { health: Health }) {
  const config = {
    green: { variant: 'success' as const, label: 'On Track' },
    yellow: { variant: 'warning' as const, label: 'At Risk' },
    red: { variant: 'danger' as const, label: 'Off Track' },
  }
  const c = config[health]
  return <Badge variant={c.variant} dot>{c.label}</Badge>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = {
    low: { variant: 'gray' as const, label: 'Low' },
    medium: { variant: 'info' as const, label: 'Medium' },
    high: { variant: 'warning' as const, label: 'High' },
    critical: { variant: 'danger' as const, label: 'Critical' },
  }
  const c = config[priority]
  return <Badge variant={c.variant}>{c.label}</Badge>
}

export function StatusBadge({ status }: { status: ProjectStatus | TaskStatus }) {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    planning: { variant: 'gray', label: 'Planning' },
    active: { variant: 'success', label: 'Active' },
    on_hold: { variant: 'warning', label: 'On Hold' },
    completed: { variant: 'default', label: 'Completed' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    todo: { variant: 'gray', label: 'To Do' },
    in_progress: { variant: 'info', label: 'In Progress' },
    review: { variant: 'warning', label: 'In Review' },
    done: { variant: 'success', label: 'Done' },
    blocked: { variant: 'danger', label: 'Blocked' },
  }
  const c = config[status] || { variant: 'gray' as const, label: status }
  return <Badge variant={c.variant}>{c.label}</Badge>
}

export function HealthDot({ health }: { health: Health }) {
  const colors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[health]} flex-shrink-0`} />
}
