import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, sprintsApi } from '../api'
import { Sprint, Project } from '../types'
import { format, parseISO, differenceInDays } from 'date-fns'
import BurndownChart from '../components/charts/BurndownChart'
import Progress from '../components/ui/Progress'
import { Zap, Target, TrendingUp, ChevronRight, Play, CheckCircle, Clock } from 'lucide-react'

const STATUS_CONFIG = {
  planned: { color: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Planned' },
  active: { color: 'bg-blue-100 text-blue-700', icon: Play, label: 'Active' },
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Completed' },
}

interface BurndownData {
  date: string
  remaining: number
  ideal: number
}

export default function Sprints() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null)
  const [burndown, setBurndown] = useState<{ data: BurndownData[]; totalPoints: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    projectsApi.list({ status: 'active' })
      .then(r => {
        const projs: Project[] = r.data.projects
        setProjects(projs)
        if (projs.length > 0) setSelectedProject(projs[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedProject) return
    sprintsApi.list(selectedProject).then(r => {
      const sprs: Sprint[] = r.data.sprints
      setSprints(sprs)
      const active = sprs.find(s => s.status === 'active')
      setSelectedSprint(active || sprs[0] || null)
    })
  }, [selectedProject])

  useEffect(() => {
    if (!selectedSprint) return
    sprintsApi.burndown(selectedSprint.id).then(r => {
      setBurndown({ data: r.data.burndown, totalPoints: r.data.totalPoints })
    }).catch(() => setBurndown(null))
  }, [selectedSprint])

  const activeSprints = sprints.filter(s => s.status === 'active')
  const completedSprints = sprints.filter(s => s.status === 'completed')
  const avgVelocity = completedSprints.length > 0
    ? Math.round(completedSprints.reduce((s, sp) => s + (sp.velocity || sp.completed_points || 0), 0) / completedSprints.length)
    : 0

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sprint Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agile sprint tracking and velocity analysis</p>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProject(p.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap flex-shrink-0 ${selectedProject === p.id ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            {p.name}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Zap, label: 'Total Sprints', value: sprints.length, color: 'bg-blue-50 text-blue-600' },
          { icon: Play, label: 'Active', value: activeSprints.length, color: 'bg-green-50 text-green-600' },
          { icon: CheckCircle, label: 'Completed', value: completedSprints.length, color: 'bg-purple-50 text-purple-600' },
          { icon: TrendingUp, label: 'Avg Velocity', value: `${avgVelocity} pts`, color: 'bg-orange-50 text-orange-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-9 h-9 ${kpi.color} rounded-lg flex items-center justify-center mb-2`}>
              <kpi.icon size={18} />
            </div>
            <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Sprint list */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Sprints</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
              {sprints.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No sprints for this project</div>
              ) : (
                sprints.map(s => {
                  const cfg = STATUS_CONFIG[s.status]
                  const Icon = cfg.icon
                  const completionPct = s.total_points ? Math.round((s.completed_points || 0) / s.total_points * 100) : 0
                  const daysLeft = s.end_date ? differenceInDays(parseISO(s.end_date), new Date()) : null

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSprint(s)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedSprint?.id === s.id ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${cfg.color}`}>
                        <Icon size={11} />
                        {cfg.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>
                        {s.goal && <div className="text-xs text-gray-400 truncate mt-0.5">{s.goal}</div>}
                        <div className="flex items-center gap-3 mt-1">
                          {s.total_points ? (
                            <span className="text-xs text-gray-500">{s.completed_points || 0}/{s.total_points} pts</span>
                          ) : null}
                          {s.status === 'active' && daysLeft !== null && (
                            <span className={`text-xs font-medium ${daysLeft < 0 ? 'text-red-500' : daysLeft < 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                            </span>
                          )}
                        </div>
                        {s.total_points && s.total_points > 0 ? (
                          <Progress value={completionPct} size="sm" color={completionPct === 100 ? 'green' : 'blue'} className="mt-1.5" />
                        ) : null}
                      </div>
                      {selectedSprint?.id === s.id && <ChevronRight size={14} className="text-blue-500 flex-shrink-0 mt-1" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Sprint detail */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {selectedSprint ? (
            <>
              {/* Sprint info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedSprint.name}</h3>
                    {selectedSprint.goal && <p className="text-sm text-gray-500 mt-1 flex items-start gap-2"><Target size={13} className="mt-0.5 flex-shrink-0 text-purple-400" />{selectedSprint.goal}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${STATUS_CONFIG[selectedSprint.status].color}`}>
                    {STATUS_CONFIG[selectedSprint.status].label}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Tasks', value: `${selectedSprint.done_tasks || 0}/${selectedSprint.total_tasks || 0}` },
                    { label: 'Story Points', value: `${selectedSprint.completed_points || 0}/${selectedSprint.total_points || 0}` },
                    { label: 'Start', value: selectedSprint.start_date ? format(parseISO(selectedSprint.start_date), 'MMM d') : '—' },
                    { label: 'End', value: selectedSprint.end_date ? format(parseISO(selectedSprint.end_date), 'MMM d') : '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                      <div className="font-bold text-gray-800">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Burndown */}
              {burndown && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <BurndownChart
                    data={burndown.data}
                    totalPoints={burndown.totalPoints}
                    sprintName={selectedSprint.name}
                  />
                </div>
              )}

              {/* Velocity history */}
              {completedSprints.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-gray-400" />
                    Velocity History
                  </h4>
                  <div className="space-y-2">
                    {completedSprints.map(s => {
                      const pts = s.velocity || s.completed_points || 0
                      const maxPts = Math.max(...completedSprints.map(cs => cs.velocity || cs.completed_points || 0))
                      return (
                        <div key={s.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600">{s.name}</span>
                            <span className="text-xs font-bold text-gray-700">{pts} pts</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: maxPts > 0 ? `${(pts / maxPts) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <TrendingUp size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500">Average velocity: <strong className="text-gray-700">{avgVelocity} points/sprint</strong></span>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate(`/projects/${selectedProject}/sprints`)}
                className="w-full text-sm text-blue-600 hover:text-blue-700 py-2 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Manage sprints in project →
              </button>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <Zap size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a sprint to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
