import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Flag, Target, AlertTriangle, Clock, LucideIcon } from 'lucide-react'
import { calendarApi } from '../api'
import { CalendarEvent } from '../types'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, format, isSameMonth, isSameDay, parseISO } from 'date-fns'

const TYPE_META: Record<string, { color: string; bg: string; icon: LucideIcon }> = {
  task: { color: 'text-blue-700', bg: 'bg-blue-100', icon: Clock },
  milestone: { color: 'text-amber-700', bg: 'bg-amber-100', icon: Flag },
  'project-end': { color: 'text-purple-700', bg: 'bg-purple-100', icon: Target },
}

export default function Calendar() {
  const [cursor, setCursor] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'task' | 'milestone' | 'project-end'>('all')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  useEffect(() => {
    setLoading(true)
    calendarApi.events({
      from: format(gridStart, 'yyyy-MM-dd'),
      to: format(gridEnd, 'yyyy-MM-dd'),
    }).then(res => setEvents(res.data.events)).finally(() => setLoading(false))
  }, [cursor])

  const days: Date[] = useMemo(() => {
    const arr: Date[] = []
    let d = gridStart
    while (d <= gridEnd) { arr.push(d); d = addDays(d, 1) }
    return arr
  }, [gridStart.toISOString(), gridEnd.toISOString()])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)
    for (const e of filtered) {
      const key = e.date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events, filter])

  const selectedEvents = selectedDay
    ? (eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || [])
    : []

  const stats = useMemo(() => {
    const monthEvents = events.filter(e => isSameMonth(parseISO(e.date), cursor))
    return {
      total: monthEvents.length,
      tasks: monthEvents.filter(e => e.type === 'task').length,
      milestones: monthEvents.filter(e => e.type === 'milestone').length,
      projectEnds: monthEvents.filter(e => e.type === 'project-end').length,
      critical: monthEvents.filter(e => e.type === 'task' && e.is_critical === 1).length,
    }
  }, [events, cursor])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon size={22} className="text-blue-600" /> Calendar
          </h1>
          <p className="text-sm text-gray-500">All task deadlines, milestones, and project end dates</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date())} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Today</button>
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <div className="px-3 py-1.5 text-sm font-semibold text-gray-700 min-w-[150px] text-center">{format(cursor, 'MMMM yyyy')}</div>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'all', label: `All (${stats.total})`, color: 'bg-gray-100 text-gray-700' },
          { id: 'task', label: `Tasks (${stats.tasks})`, color: 'bg-blue-100 text-blue-700' },
          { id: 'milestone', label: `Milestones (${stats.milestones})`, color: 'bg-amber-100 text-amber-700' },
          { id: 'project-end', label: `Project ends (${stats.projectEnds})`, color: 'bg-purple-100 text-purple-700' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filter === f.id ? f.color + ' ring-2 ring-offset-1 ring-current/40' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
          >
            {f.label}
          </button>
        ))}
        {stats.critical > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertTriangle size={12} /> {stats.critical} critical-path deadline{stats.critical > 1 ? 's' : ''} this month
          </span>
        )}
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Calendar grid */}
        <div className="col-span-12 lg:col-span-9 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-xs font-semibold text-gray-500 px-2 py-2 text-center uppercase tracking-wider">{d}</div>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-96"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-7 grid-rows-6 auto-rows-fr">
              {days.map(d => {
                const key = format(d, 'yyyy-MM-dd')
                const dayEvents = eventsByDay.get(key) || []
                const inMonth = isSameMonth(d, cursor)
                const isToday = isSameDay(d, new Date())
                const isSelected = selectedDay && isSameDay(d, selectedDay)
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(d)}
                    className={`min-h-[90px] border-r border-b border-gray-100 p-1.5 text-left hover:bg-gray-50 ${!inMonth ? 'bg-gray-50/50' : ''} ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                  >
                    <div className={`text-xs font-semibold mb-1 inline-flex items-center justify-center min-w-[20px] h-5 rounded ${isToday ? 'bg-blue-600 text-white px-1.5' : inMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                      {format(d, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((e, idx) => {
                        const meta = TYPE_META[e.type]
                        return (
                          <div
                            key={`${e.type}-${e.id}-${idx}`}
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate ${meta.bg} ${meta.color} flex items-center gap-1`}
                            title={`${e.title} — ${e.project_name}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                            {e.is_critical === 1 && <AlertTriangle size={8} className="flex-shrink-0" />}
                            <span className="truncate">{e.title}</span>
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-gray-500 font-medium">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar: selected day events */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 self-start">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Select a day'}
          </h3>
          {selectedDay && selectedEvents.length === 0 && (
            <p className="text-xs text-gray-400">No events on this day.</p>
          )}
          <div className="space-y-2">
            {selectedEvents.map((e, idx) => {
              const meta = TYPE_META[e.type]
              const Icon = meta.icon
              return (
                <Link
                  key={`${e.type}-${e.id}-${idx}`}
                  to={`/projects/${e.project_id}${e.type === 'task' ? '/tasks' : ''}`}
                  className="block p-2 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-2">
                    <div className={`p-1 rounded ${meta.bg} ${meta.color}`}><Icon size={12} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{e.title}</div>
                      <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                        {e.project_name}
                      </div>
                      {e.assignee_name && <div className="text-[10px] text-gray-400 mt-0.5">→ {e.assignee_name}</div>}
                    </div>
                    {e.is_critical === 1 && <AlertTriangle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
