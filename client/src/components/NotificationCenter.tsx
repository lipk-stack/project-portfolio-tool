import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, DollarSign, Calendar, CheckSquare, X, CheckCheck } from 'lucide-react'
import { notificationsApi } from '../api'
import { useNotificationStore } from '../store'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface Notification {
  id: number
  type: string
  title: string
  message?: string
  entity_type?: string
  entity_id?: number
  read: number
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  risk: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  budget: { icon: DollarSign, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  milestone: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
  task: { icon: CheckSquare, color: 'text-purple-600', bg: 'bg-purple-50' },
  default: { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-50' },
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { unreadCount, setUnreadCount } = useNotificationStore()
  const panelRef = useRef<HTMLDivElement>(null)

  const loadNotifications = async () => {
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data.notifications)
      setUnreadCount(res.data.unreadCount)
    } catch {}
  }

  useEffect(() => { loadNotifications() }, [])

  useEffect(() => {
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
    setUnreadCount(0)
  }

  const handleMarkRead = async (id: number) => {
    await notificationsApi.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
    setUnreadCount(Math.max(0, unreadCount - 1))
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-gray-600 dark:text-gray-400" />
              <span className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</span>
              {unreadCount > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-bold">{unreadCount}</span>}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications</div>
            ) : (
              notifications.map(notif => {
                const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.default
                const Icon = cfg.icon
                return (
                  <div
                    key={notif.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50/40 dark:bg-blue-950/30' : ''}`}
                    onClick={() => !notif.read && handleMarkRead(notif.id)}
                  >
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm font-medium ${!notif.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{notif.title}</span>
                        {!notif.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                      </div>
                      {notif.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>}
                      <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}</p>
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
