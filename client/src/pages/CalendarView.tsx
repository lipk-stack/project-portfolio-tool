import { useEffect, useState } from 'react'
import api from '../api'
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isToday, parseISO, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Diamond, CheckSquare } from 'lucide-react'

interface CalTask {
  id: number; name: string; status: string; priority: string
  start_date: string | null; end_date: string | null
  completion_percent: number; assignee_name: string | null
  project_id: number; project_name: string; project_color: string
}
interface CalMilestone {
  id: number; name: string; date: string; status: string
  project_id: number; project_name: string; project_color: string
}

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-blue-400', low: 'bg-gray-300'
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = startOfMonth(new Date(year, month - 1))
  const lastDay = endOfMonth(firstDay)
  const start = startOfWeek(firstDay, { weekStartsOn: 0 })
  const days: Date[] = []
  let cur = start
  while (cur <= lastDay || days.length % 7 !== 0 || days.length < 35) {
    days.push(cur)
    cur = addDays(cur, 1)
    if (days.length >= 42) break
  }
  return days
}

export default function CalendarView() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tasks, setTasks] = useState<CalTask[]>([])
  const [milestones, setMilestones] = useState<CalMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  useEffect(() => {
    setLoading(true)
    api.get('/calendar', { params: { year, month } }).then(r => {
      setTasks(r.data.tasks)
      setMilestones(r.data.milestones)
    }).finally(() => setLoading(false))
  }, [year, month])

  const navigate = (dir: number) => {
    const d = new Date(year, month - 1 + dir)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDay(null)
  }

  const days = getCalendarDays(year, month)

  const tasksOnDay = (day: Date) => tasks.filter(t => {
    if (t.end_date && isSameDay(parseISO(t.end_date), day)) return true
    return false
  })
  const milestonesOnDay = (day: Date) => milestones.filter(m => m.date && isSameDay(parseISO(m.date), day))

  const selectedTasks = selectedDay ? tasksOnDay(selectedDay) : []
  const selectedMilestones = selectedDay ? milestonesOnDay(selectedDay) : []

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tasks and milestones across all active projects</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >Today</button>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronLeft size={18} /></button>
            <span className="text-base font-semibold text-gray-900 min-w-[160px] text-center">
              {format(new Date(year, month - 1), 'MMMM yyyy')}
            </span>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Calendar grid */}
        <div className="col-span-12 lg:col-span-9">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const dayTasks = tasksOnDay(day)
                  const dayMilestones = milestonesOnDay(day)
                  const isCurrentMonth = isSameMonth(day, new Date(year, month - 1))
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const hasItems = dayTasks.length > 0 || dayMilestones.length > 0

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                        !isCurrentMonth ? 'bg-gray-50' : ''
                      } ${isSelected ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday(day) ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {dayMilestones.slice(0, 2).map(m => (
                          <div key={`m${m.id}`} className="flex items-center gap-1 text-xs py-0.5 px-1 rounded" style={{ backgroundColor: `${m.project_color}20` }}>
                            <Diamond size={8} style={{ color: m.project_color }} className="flex-shrink-0" fill={m.project_color} />
                            <span className="truncate font-medium" style={{ color: m.project_color }}>{m.name}</span>
                          </div>
                        ))}
                        {dayTasks.slice(0, 3 - dayMilestones.length).map(t => (
                          <div key={`t${t.id}`} className="flex items-center gap-1 text-xs py-0.5 px-1 rounded bg-gray-100">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] || 'bg-gray-300'}`} />
                            <span className="truncate text-gray-600">{t.name}</span>
                          </div>
                        ))}
                        {hasItems && (dayTasks.length + dayMilestones.length > 3) && (
                          <div className="text-xs text-gray-400 px-1">+{(dayTasks.length + dayMilestones.length) - 3} more</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {selectedDay ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                {format(selectedDay, 'EEEE, MMMM d')}
              </h3>
              {selectedMilestones.length === 0 && selectedTasks.length === 0 && (
                <p className="text-sm text-gray-400">No tasks or milestones due</p>
              )}
              {selectedMilestones.map(m => (
                <div key={m.id} className="mb-2 p-2.5 rounded-lg border-l-4" style={{ borderColor: m.project_color, backgroundColor: `${m.project_color}10` }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Diamond size={10} style={{ color: m.project_color }} fill={m.project_color} />
                    <span className="text-xs font-semibold" style={{ color: m.project_color }}>Milestone</span>
                  </div>
                  <div className="text-sm font-medium text-gray-800">{m.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.project_name}</div>
                </div>
              ))}
              {selectedTasks.map(t => (
                <div key={t.id} className="mb-2 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.project_color }} />
                    <span className="text-xs text-gray-500">{t.project_name}</span>
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-medium ${
                      t.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      t.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{t.priority}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-800">{t.name}</div>
                  {t.assignee_name && <div className="text-xs text-gray-400 mt-0.5">→ {t.assignee_name}</div>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1">
                      <div className="h-1 rounded-full bg-blue-500" style={{ width: `${t.completion_percent}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{t.completion_percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">This Month</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckSquare size={14} className="text-blue-500" />
                    <span>Tasks due</span>
                  </div>
                  <span className="font-semibold text-gray-900">{tasks.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Diamond size={14} className="text-purple-500" />
                    <span>Milestones</span>
                  </div>
                  <span className="font-semibold text-gray-900">{milestones.length}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Click a day to see details</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Upcoming Milestones</h3>
            {milestones.length === 0 ? (
              <p className="text-xs text-gray-400">No milestones this month</p>
            ) : (
              <div className="space-y-2">
                {milestones.slice(0, 6).map(m => (
                  <div key={m.id} className="flex items-start gap-2">
                    <Diamond size={10} style={{ color: m.project_color }} fill={m.project_color} className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{m.name}</div>
                      <div className="text-xs text-gray-400">{m.project_name} · {format(parseISO(m.date), 'MMM d')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
