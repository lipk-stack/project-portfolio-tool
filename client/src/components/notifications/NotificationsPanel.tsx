import { useState, useEffect, useRef } from 'react'
import { Bell, X, AlertTriangle, DollarSign, Calendar, Shield, CheckCircle, Info } from 'lucide-react'
import { notificationsApi } from '../../api'
import { Notification } from '../../types'
import { formatDistanceToNow, parseISO } from 'date-fns'

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  budget_alert: { icon: DollarSign, color: 'text-orange-500', bg: 'bg-orange-50' },
  overdue_task: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
  milestone_due: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50' },
  high_risk: { icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
  task_assigned: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
  default: { icon: Info, color: 'text-gray-500', bg: 'bg-gray-50' },
}

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [systemAlerts, setSystemAlerts] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data.notifications || [])
      setSystemAlerts(res.data.systemAlerts || [])
      setUnreadCount(res.data.unreadCount || 0)
    } catch {}
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setUnreadCount(0)
    setNotifications(n => n.map(x => ({ ...x, is_read: 1 })))
  }

  const allNotifs = [...systemAlerts, ...notifications].slice(0, 20)

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold px-0.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {allNotifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications</p>
              </div>
            ) : (
              allNotifs.map((n, i) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.default
                const Icon = cfg.icon
                const isRead = n.is_read === 1
                return (
                  <div key={n.id || i} className={`flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!isRead ? 'bg-blue-50/30' : ''}`}>
                    <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium leading-tight ${!isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${n.priority === 'high' ? 'bg-red-400' : n.priority === 'medium' ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
