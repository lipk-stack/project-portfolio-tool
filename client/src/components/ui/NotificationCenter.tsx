import { useState, useEffect, useRef } from 'react'
import { Bell, X, AlertTriangle, DollarSign, Users, Flag, Calendar, CheckCircle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'

interface Insight {
  type: string
  severity: string
  title: string
  detail: string
}

const TYPE_ICON: Record<string, React.ElementType> = {
  budget: DollarSign,
  schedule: Calendar,
  resource: Users,
  risk: AlertTriangle,
  milestone: Flag,
  health: CheckCircle,
}

const SEVERITY_STYLE: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  critical: { dot: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  warning: { dot: 'bg-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  info: { dot: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    api.get('/reports/insights').then(r => setInsights(r.data.insights)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const visible = insights.filter((_, i) => !dismissed.has(i))
  const criticalCount = visible.filter(i => i.severity === 'critical').length
  const badgeCount = visible.length

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-lg transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
        title="Notifications & Insights"
      >
        <Bell size={20} className={badgeCount > 0 ? 'text-gray-700' : 'text-gray-500'} />
        {badgeCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-5 h-5 text-white text-xs font-bold rounded-full flex items-center justify-center ${criticalCount > 0 ? 'bg-red-500' : 'bg-yellow-500'}`}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Smart Insights</h3>
              <p className="text-xs text-gray-400 mt-0.5">{visible.length} action items across your portfolio</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          {/* Insights list */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && visible.length === 0 && (
              <div className="px-4 py-8 text-center">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm font-medium text-gray-700">All clear!</p>
                <p className="text-xs text-gray-400 mt-1">No critical issues detected across your portfolio</p>
              </div>
            )}

            {!loading && insights.map((insight, i) => {
              if (dismissed.has(i)) return null
              const IIcon = TYPE_ICON[insight.type] || AlertTriangle
              const style = SEVERITY_STYLE[insight.severity] || SEVERITY_STYLE.info
              return (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group`}>
                  <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.border} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <IIcon size={14} className={style.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800 leading-snug">{insight.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{insight.detail}</p>
                      </div>
                      <button
                        onClick={() => setDismissed(prev => new Set([...prev, i]))}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-gray-500 transition-all flex-shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${style.bg} ${style.text} border ${style.border} capitalize`}>
                        {insight.severity}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{insight.type}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {visible.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => setDismissed(new Set(insights.map((_, i) => i)))}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Dismiss all
              </button>
              <button
                onClick={() => { navigate('/reports'); setOpen(false) }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View Reports <ExternalLink size={11} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
