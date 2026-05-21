import { useEffect, useState } from 'react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Clock, Check, Trash2, Users } from 'lucide-react'
import api from '../api'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Progress from '../components/ui/Progress'

interface TimeEntry {
  id: number; task_id: number | null; project_id: number
  hours: number; date: string; description: string
  task_name: string; project_name: string; project_color: string
}
interface MyProject { id: number; name: string; color: string }
interface MyTask { id: number; name: string; project_id: number; project_name: string }
interface WeekData {
  entries: TimeEntry[]; weekStart: string; weekEnd: string; weekTotal: number
  myProjects: MyProject[]; myTasks: MyTask[]
}
interface TeamMember {
  id: number; name: string; department: string; capacity: number
  hours_logged: number; utilization_pct: number
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekStart(d: Date): string {
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return mon.toISOString().split('T')[0]
}

export default function Timesheets() {
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
  const [data, setData] = useState<WeekData | null>(null)
  const [teamData, setTeamData] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'my' | 'team'>('my')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ project_id: '', task_id: '', date: new Date().toISOString().split('T')[0], hours: '8', description: '' })

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/timesheets/my', { params: { week: currentWeek } }),
      api.get('/timesheets/team', { params: { week: currentWeek } }),
    ]).then(([myRes, teamRes]) => {
      setData(myRes.data)
      setTeamData(teamRes.data.summary)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [currentWeek])

  const handleSubmit = async () => {
    if (!form.project_id || !form.hours || !form.date) return
    setSaving(true)
    try {
      await api.post('/timesheets', {
        project_id: parseInt(form.project_id),
        task_id: form.task_id ? parseInt(form.task_id) : null,
        hours: parseFloat(form.hours),
        date: form.date,
        description: form.description,
      })
      setShowForm(false)
      setForm({ project_id: '', task_id: '', date: new Date().toISOString().split('T')[0], hours: '8', description: '' })
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/timesheets/${id}`)
    load()
  }

  const prevWeek = () => {
    const d = parseISO(currentWeek)
    setCurrentWeek(getWeekStart(subWeeks(d, 1)))
  }
  const nextWeek = () => {
    const d = parseISO(currentWeek)
    setCurrentWeek(getWeekStart(addWeeks(d, 1)))
  }

  const weekDays = data ? Array.from({ length: 7 }, (_, i) => {
    const d = new Date(data.weekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  }) : []

  const entriesByDay = (day: string) => (data?.entries || []).filter(e => e.date === day)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and review time logged across projects</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            {(['my', 'team'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeView === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {v === 'my' ? 'My Time' : 'Team'}
              </button>
            ))}
          </div>
          {activeView === 'my' && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <Plus size={16} /> Log Time
            </button>
          )}
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-4">
        <button onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft size={16} /></button>
        <div className="flex-1 text-center">
          <span className="text-base font-semibold text-gray-900">
            {data && `${format(parseISO(data.weekStart), 'MMM d')} – ${format(parseISO(data.weekEnd), 'MMM d, yyyy')}`}
          </span>
        </div>
        <button onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronRight size={16} /></button>
        <button
          onClick={() => setCurrentWeek(getWeekStart(new Date()))}
          className="px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          This Week
        </button>
      </div>

      {activeView === 'my' && data && (
        <>
          {/* Log time form */}
          {showForm && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Log Time Entry</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Project *</label>
                  <select
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value, task_id: '' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select project...</option>
                    {data.myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Task (optional)</label>
                  <select
                    value={form.task_id}
                    onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!form.project_id}
                  >
                    <option value="">— No task —</option>
                    {data.myTasks.filter(t => t.project_id === parseInt(form.project_id)).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hours *</label>
                  <input
                    type="number"
                    min="0.5" max="24" step="0.5"
                    value={form.hours}
                    onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What did you work on?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={saving || !form.project_id || !form.hours} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                  Save Entry
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </Card>
          )}

          {/* Weekly summary */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <div className="text-2xl font-bold text-gray-900">{data.weekTotal.toFixed(1)}h</div>
              <div className="text-sm text-gray-500 mt-1">Hours this week</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-gray-900">{Math.round(data.weekTotal / 40 * 100)}%</div>
              <div className="text-sm text-gray-500 mt-1">Weekly capacity</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-gray-900">{data.entries.length}</div>
              <div className="text-sm text-gray-500 mt-1">Entries logged</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-gray-900">
                {new Set(data.entries.map(e => e.project_id)).size}
              </div>
              <div className="text-sm text-gray-500 mt-1">Projects worked</div>
            </Card>
          </div>

          {/* Daily breakdown */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, i) => {
              const dayEntries = entriesByDay(day)
              const dayHours = dayEntries.reduce((s, e) => s + e.hours, 0)
              const isWeekend = i >= 5
              const isToday = day === new Date().toISOString().split('T')[0]
              return (
                <div key={day} className={`bg-white rounded-xl border p-3 ${isToday ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'} ${isWeekend ? 'opacity-60' : ''}`}>
                  <div className="text-xs font-semibold text-gray-500 mb-1">{DAYS[i]}</div>
                  <div className="text-sm text-gray-400 mb-2">{format(parseISO(day), 'MMM d')}</div>
                  <div className="text-lg font-bold text-gray-900">{dayHours > 0 ? `${dayHours.toFixed(1)}h` : '—'}</div>
                  {dayEntries.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {dayEntries.map(e => (
                        <div key={e.id} className="flex items-center gap-1 group">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.project_color }} />
                          <span className="text-xs text-gray-500 truncate flex-1">{e.project_name}</span>
                          <span className="text-xs font-medium text-gray-700">{e.hours}h</span>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* All entries table */}
          {data.entries.length > 0 && (
            <Card padding="none">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Time Entries</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.entries.map(e => (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.project_color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{e.project_name}</div>
                      {e.task_name && <div className="text-xs text-gray-400">{e.task_name}</div>}
                      {e.description && <div className="text-xs text-gray-500 italic">{e.description}</div>}
                    </div>
                    <div className="text-sm text-gray-500">{format(parseISO(e.date), 'EEE, MMM d')}</div>
                    <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                      <Clock size={14} className="text-gray-400" />
                      {e.hours}h
                    </div>
                    <button onClick={() => handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.entries.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No time logged this week</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-blue-600 hover:text-blue-700">Log your first entry →</button>
            </div>
          )}
        </>
      )}

      {activeView === 'team' && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users size={16} className="text-gray-400" /> Team Time Tracking</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {teamData.map(member => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                <Avatar name={member.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{member.name}</div>
                  <div className="text-xs text-gray-400">{member.department}</div>
                </div>
                <div className="w-32">
                  <Progress value={Math.min(member.utilization_pct, 100)} size="sm" color={member.utilization_pct > 100 ? 'red' : member.utilization_pct > 80 ? 'green' : 'blue'} />
                </div>
                <div className="text-right w-24">
                  <div className="text-sm font-bold text-gray-900">{member.hours_logged.toFixed(1)}h</div>
                  <div className={`text-xs ${member.utilization_pct > 100 ? 'text-red-500' : 'text-gray-400'}`}>{member.utilization_pct.toFixed(0)}%</div>
                </div>
              </div>
            ))}
            {teamData.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-400">No time logged this week by any team member</div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
