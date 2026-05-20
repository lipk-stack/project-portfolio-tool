import { useEffect, useState, useCallback } from 'react'
import { timesheetsApi } from '../api'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import { useAuthStore } from '../store'
import { ChevronLeft, ChevronRight, Clock, Plus, Check, AlertTriangle, Calendar, Users } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, parseISO } from 'date-fns'

interface TimeEntry {
  id: number
  task_id?: number
  project_id: number
  hours: number
  date: string
  description?: string
  task_name?: string
  project_name?: string
  project_color?: string
}

interface Project {
  id: number
  name: string
  color: string
}

interface TeamMember {
  id: number
  name: string
  department: string
  capacity: number
  logged_hours: number
  project_count: number
  projects: Array<{ project_id: number; project_name: string; color: string; hours: number }>
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Timesheets() {
  const user = useAuthStore(s => s.user)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my')
  const [editCell, setEditCell] = useState<{ projectId: number; date: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [showAddProject, setShowAddProject] = useState(false)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endStr = format(weekEnd, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [myRes, teamRes] = await Promise.all([
        timesheetsApi.list(startStr, endStr),
        timesheetsApi.teamSummary(startStr, endStr),
      ])
      setEntries(myRes.data.entries)
      setProjects(myRes.data.projects)
      setTeam(teamRes.data.summary)
    } finally {
      setLoading(false)
    }
  }, [startStr, endStr])

  useEffect(() => { load() }, [load])

  // Build a lookup: projectId -> date -> entry
  const entryMap: Record<number, Record<string, TimeEntry>> = {}
  for (const e of entries) {
    if (!entryMap[e.project_id]) entryMap[e.project_id] = {}
    entryMap[e.project_id][e.date] = e
  }

  // Which projects to show in my view (projects with entries + assigned projects)
  const shownProjectIds = new Set([
    ...projects.map(p => p.id),
    ...entries.map(e => e.project_id),
  ])
  const shownProjects = projects.filter(p => shownProjectIds.has(p.id))

  // Daily totals
  const dayTotals: Record<string, number> = {}
  for (const e of entries) {
    dayTotals[e.date] = (dayTotals[e.date] || 0) + e.hours
  }
  const weekTotal = Object.values(dayTotals).reduce((s, v) => s + v, 0)

  const startEdit = (projectId: number, date: string) => {
    const existing = entryMap[projectId]?.[date]
    setEditCell({ projectId, date })
    setEditValue(existing ? String(existing.hours) : '')
    setEditDesc(existing?.description || '')
  }

  const saveEdit = async () => {
    if (!editCell) return
    const hours = parseFloat(editValue)
    if (isNaN(hours) || editValue === '') {
      // Delete if clearing
      const existing = entryMap[editCell.projectId]?.[editCell.date]
      if (existing) {
        setSaving(`${editCell.projectId}-${editCell.date}`)
        await timesheetsApi.delete(existing.id)
        setSaving(null)
        await load()
      }
      setEditCell(null)
      return
    }
    if (hours < 0 || hours > 24) return

    setSaving(`${editCell.projectId}-${editCell.date}`)
    const existing = entryMap[editCell.projectId]?.[editCell.date]
    if (existing) {
      await timesheetsApi.update(existing.id, { hours, description: editDesc })
    } else {
      await timesheetsApi.create({
        project_id: editCell.projectId,
        hours,
        date: editCell.date,
        description: editDesc || undefined,
      })
    }
    setSaving(null)
    setEditCell(null)
    await load()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') setEditCell(null)
    if (e.key === 'Tab') { e.preventDefault(); saveEdit() }
  }

  const weekCapacity = (user?.capacity || 40)
  const utilizationPct = weekCapacity > 0 ? Math.round((weekTotal / weekCapacity) * 100) : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and submit weekly hours</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setActiveTab('my')} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${activeTab === 'my' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Clock size={14} /> My Time
            </button>
            <button onClick={() => setActiveTab('team')} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${activeTab === 'team' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Users size={14} /> Team
            </button>
          </div>
        </div>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3">
        <button onClick={() => setCurrentWeek(w => subWeeks(w, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900">{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}</div>
          <div className="text-xs text-gray-400 mt-0.5">Week {format(weekStart, 'w')} of {format(weekStart, 'yyyy')}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <button onClick={() => setCurrentWeek(w => addWeeks(w, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {activeTab === 'my' && (
        <>
          {/* My KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center">
              <div className="text-3xl font-bold text-gray-900">{weekTotal.toFixed(1)}h</div>
              <div className="text-sm text-gray-500 mt-0.5">Hours This Week</div>
            </Card>
            <Card className="text-center">
              <div className={`text-3xl font-bold ${utilizationPct > 100 ? 'text-red-600' : utilizationPct > 80 ? 'text-green-600' : 'text-blue-600'}`}>{utilizationPct}%</div>
              <div className="text-sm text-gray-500 mt-0.5">Utilization</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-gray-900">{Math.max(0, weekCapacity - weekTotal).toFixed(1)}h</div>
              <div className="text-sm text-gray-500 mt-0.5">Remaining Capacity</div>
            </Card>
          </div>

          {/* Capacity warning */}
          {weekTotal > weekCapacity && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} />
              You have logged {(weekTotal - weekCapacity).toFixed(1)}h over your weekly capacity of {weekCapacity}h
            </div>
          )}

          {/* Timesheet grid */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <Card padding="none">
              <div className="overflow-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 sticky left-0 bg-gray-50 z-10 min-w-[180px]">Project</th>
                      {days.map((day, i) => (
                        <th key={i} className={`text-center text-xs font-semibold px-3 py-3 min-w-[88px] ${isToday(day) ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
                          <div>{DAYS[i]}</div>
                          <div className={`text-lg font-bold mt-0.5 ${isToday(day) ? 'text-blue-600' : 'text-gray-800'}`}>{format(day, 'd')}</div>
                        </th>
                      ))}
                      <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3 min-w-[72px]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shownProjects.map(project => {
                      const rowTotal = days.reduce((sum, day) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        return sum + (entryMap[project.id]?.[dateStr]?.hours || 0)
                      }, 0)
                      return (
                        <tr key={project.id} className="hover:bg-gray-50/50 group">
                          <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-gray-50/50 z-10">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                              <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">{project.name}</span>
                            </div>
                          </td>
                          {days.map((day, di) => {
                            const dateStr = format(day, 'yyyy-MM-dd')
                            const entry = entryMap[project.id]?.[dateStr]
                            const isEditing = editCell?.projectId === project.id && editCell?.date === dateStr
                            const isSaving = saving === `${project.id}-${dateStr}`
                            const isWeekend = di >= 5

                            return (
                              <td key={di} className={`px-2 py-2 text-center ${isWeekend ? 'bg-gray-50/50' : ''} ${isToday(day) ? 'bg-blue-50/30' : ''}`}>
                                {isEditing ? (
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="number"
                                      min="0" max="24" step="0.5"
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      onKeyDown={handleKeyDown}
                                      onBlur={saveEdit}
                                      className="w-16 text-center text-sm border border-blue-400 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 mx-auto block"
                                      placeholder="h"
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => startEdit(project.id, dateStr)}
                                    className={`w-16 h-9 rounded text-sm font-medium transition-all hover:ring-2 hover:ring-blue-400 mx-auto block ${
                                      isSaving ? 'bg-blue-100 text-blue-600' :
                                      entry ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                      'bg-white border border-dashed border-gray-200 text-gray-300 hover:text-gray-400 hover:border-gray-300'
                                    }`}
                                    title={entry?.description}
                                  >
                                    {isSaving ? <Check size={14} className="mx-auto" /> :
                                      entry ? entry.hours + 'h' : '+'}
                                  </button>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-center">
                            <span className={`text-sm font-semibold ${rowTotal > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                              {rowTotal > 0 ? `${rowTotal.toFixed(1)}h` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {shownProjects.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                          <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                          No projects assigned. Log time by clicking a cell.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">Daily Total</td>
                      {days.map((day, di) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const total = dayTotals[dateStr] || 0
                        return (
                          <td key={di} className={`px-3 py-3 text-center ${isToday(day) ? 'bg-blue-50' : ''}`}>
                            <span className={`text-sm font-bold ${total > 8 ? 'text-red-600' : total > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                              {total > 0 ? `${total.toFixed(1)}h` : '—'}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold ${weekTotal > weekCapacity ? 'text-red-600' : weekTotal > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                          {weekTotal > 0 ? `${weekTotal.toFixed(1)}h` : '—'}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">Click a cell to log hours. Press Enter to save, Esc to cancel.</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Weekly capacity: <strong className="text-gray-700">{weekCapacity}h</strong></span>
                  <span>Logged: <strong className={weekTotal > weekCapacity ? 'text-red-600' : 'text-gray-700'}>{weekTotal.toFixed(1)}h</strong></span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Team Time Summary</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {team.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                No team activity recorded for this week
              </div>
            ) : (
              team.map(member => {
                const capacity = member.capacity || 40
                const pct = capacity > 0 ? Math.round((member.logged_hours / capacity) * 100) : 0
                return (
                  <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <Avatar name={member.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{member.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{member.department}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{member.project_count} project{member.project_count !== 1 ? 's' : ''}</span>
                          <span className={`font-bold text-sm ${pct > 100 ? 'text-red-600' : pct > 80 ? 'text-green-600' : 'text-gray-700'}`}>
                            {member.logged_hours.toFixed(1)}h
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${pct > 100 ? 'bg-red-100 text-red-700' : pct > 80 ? 'bg-green-100 text-green-700' : pct > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: pct > 100 ? '#ef4444' : pct > 80 ? '#22c55e' : '#3b82f6'
                          }}
                        />
                      </div>
                      {member.projects.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {member.projects.map(p => (
                            <span key={p.project_id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.color }}>
                              {p.project_name.length > 14 ? p.project_name.slice(0, 14) + '…' : p.project_name} · {p.hours.toFixed(1)}h
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
