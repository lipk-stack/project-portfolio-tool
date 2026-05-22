import { useState } from 'react'
import { ResourceSummary } from '../types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Avatar from './ui/Avatar'

interface WorkloadHeatmapProps {
  resources: ResourceSummary[]
}

function getUtilizationColor(pct: number): string {
  if (pct === 0) return 'bg-gray-100'
  if (pct <= 40) return 'bg-blue-100'
  if (pct <= 70) return 'bg-blue-300'
  if (pct <= 90) return 'bg-green-400'
  if (pct <= 100) return 'bg-green-500'
  if (pct <= 120) return 'bg-yellow-400'
  return 'bg-red-500'
}

export default function WorkloadHeatmap({ resources }: WorkloadHeatmapProps) {
  const [month, setMonth] = useState(new Date())

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })

  // Simulate daily load based on allocation (in production this would come from time entries)
  function getDayLoad(resource: ResourceSummary, day: Date): number {
    const dayOfWeek = getDay(day)
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0  // Weekend
    return resource.total_allocation
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700">{format(month, 'MMMM yyyy')}</span>
        <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-gray-400">Utilization:</span>
        {[
          { color: 'bg-gray-100', label: '0%' },
          { color: 'bg-blue-100', label: '≤40%' },
          { color: 'bg-blue-300', label: '≤70%' },
          { color: 'bg-green-400', label: '≤90%' },
          { color: 'bg-green-500', label: '100%' },
          { color: 'bg-yellow-400', label: '≤120%' },
          { color: 'bg-red-500', label: '>120%' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="flex mb-1">
            <div className="w-36 flex-shrink-0" />
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
              {days.map((day, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs text-gray-400">{i < 7 ? weekdays[getDay(day) === 0 ? 6 : getDay(day) - 1] : ''}</div>
                  <div className={`text-xs ${getDay(day) === 0 || getDay(day) === 6 ? 'text-gray-300' : 'text-gray-500'}`}>{format(day, 'd')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Resource rows */}
          {resources.slice(0, 12).map(resource => (
            <div key={resource.id} className="flex items-center mb-1">
              <div className="w-36 flex-shrink-0 flex items-center gap-2 pr-3">
                <Avatar name={resource.name} size="xs" />
                <span className="text-xs text-gray-700 truncate">{resource.name.split(' ')[0]}</span>
                <span className={`text-xs font-semibold ml-auto ${resource.total_allocation > 100 ? 'text-red-500' : 'text-gray-500'}`}>
                  {resource.total_allocation}%
                </span>
              </div>
              <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                {days.map((day, i) => {
                  const load = getDayLoad(resource, day)
                  const isWeekend = getDay(day) === 0 || getDay(day) === 6
                  return (
                    <div
                      key={i}
                      title={isWeekend ? 'Weekend' : `${resource.name}: ${load}% on ${format(day, 'MMM d')}`}
                      className={`h-5 rounded-sm ${isWeekend ? 'bg-gray-50' : getUtilizationColor(load)} cursor-help transition-opacity hover:opacity-80`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
