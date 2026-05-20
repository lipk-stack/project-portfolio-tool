import { useState, useEffect, useRef } from 'react'
import { Bell, Check, Trash2, AlertTriangle, CheckCircle, Calendar, DollarSign, FileText, AlertCircle, X } from 'lucide-react'
import { notificationsApi } from '../../api'
import { Notification } from '../../types'
import { useNotificationStore } from '../../store'
import { formatDistanceToNow, parseISO } from 'date-fns'

const TYPE_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  task_overdue: { icon: <AlertCircle size={14} className="text-red-500" />, bg: 'bg-red-100' },
  task_assigned: { icon: <CheckCircle size={14} className="text-blue-500" />, bg: 'bg-blue-100' },
  milestone_due: { icon: <Calendar size={14} className="text-purple-500" />, bg: 'bg-purple-100' },
  budget_alert: { icon: <DollarSign size={14} className="text-orange-500" />, bg: 'bg-orange-100' },
  risk_alert: { icon: <AlertTriangle size={14} className="text-red-500" />, bg: 'bg-red-100' },
  cr_pending: { icon: <FileText size={14} className="text-blue-500" />, bg: 'bg-blue-100' },
  issue_assigned: { icon: <AlertCircle size={14} className="text-orange-500" />, bg: 'bg-orange-100' },
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unreadCount = useNotificationStore(s => s.unreadCount)
  const setUnreadCount = useNotificationStore(s => s.setUnreadCount)
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data.notifications)
      setUnreadCount(res.data.unreadCount)
    } catch {}
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
    setUnreadCount(0)
  }

  const markRead = async (id: number) => {
    await notificationsApi.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
    setUnreadCount(Math.max(0, unreadCount - 1))
  }

  const deleteNotif = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    await notificationsApi.delete(id)
    const notif = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (notif && !notif.read) setUnreadCount(Math.max(0, unreadCount - 1))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                  <Check size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                No notifications
              </div>
            ) : (
              notifications.map(n => {
                const iconConfig = TYPE_ICONS[n.type] || { icon: <Bell size={14} className="text-gray-500" />, bg: 'bg-gray-100' }
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group ${n.read ? 'bg-white' : 'bg-blue-50'} hover:bg-gray-50`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconConfig.bg}`}>
                      {iconConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${n.read ? 'text-gray-700' : 'font-medium text-gray-900'}`}>{n.title}</div>
                      {n.message && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>}
                      <div className="text-xs text-gray-400 mt-1">{formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      <button onClick={e => deleteNotif(n.id, e)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
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
