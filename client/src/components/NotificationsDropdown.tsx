import { useEffect, useState, useRef } from 'react'
import { Bell, CheckCheck, AtSign, AlertTriangle, Calendar, UserPlus, LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { notificationsApi } from '../api'
import { getSocket } from '../realtime'
import { Notification } from '../types'
import { formatDistanceToNow, parseISO } from 'date-fns'

const TYPE_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  comment: { icon: AtSign, color: 'text-blue-600 bg-blue-50' },
  assignment: { icon: UserPlus, color: 'text-purple-600 bg-purple-50' },
  risk: { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  milestone: { icon: Calendar, color: 'text-amber-600 bg-amber-50' },
}

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data.notifications)
      setUnread(res.data.unread)
    } catch { /* unauthenticated */ }
  }

  useEffect(() => {
    load()
    // WebSocket push is the primary channel; a slow poll covers reconnect gaps.
    const interval = setInterval(load, 120000)
    const socket = getSocket()
    const onNotification = (n: Notification) => {
      setNotifications(prev => [n, ...prev].slice(0, 50))
      setUnread(u => u + 1)
    }
    socket?.on('notification', onNotification)
    return () => {
      clearInterval(interval)
      socket?.off('notification', onNotification)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markRead = async (id: number) => {
    await notificationsApi.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
    setUnread(u => Math.max(0, u - 1))
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">No notifications</div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_ICON[n.type] || { icon: Bell, color: 'text-gray-600 bg-gray-50' }
                const Icon = meta.icon
                const body = (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-gray-800 line-clamp-2">{n.title}</div>
                      {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                    </div>
                    {n.message && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>}
                    <div className="text-[10px] text-gray-400 mt-0.5">{formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}</div>
                  </div>
                )
                const inner = (
                  <div className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${!n.read ? 'bg-blue-50/30' : ''}`}>
                    <div className={`p-1.5 rounded-lg ${meta.color}`}><Icon size={14} /></div>
                    {body}
                  </div>
                )
                return (
                  <div key={n.id} onClick={() => markRead(n.id)}>
                    {n.link ? <Link to={n.link} onClick={() => setOpen(false)}>{inner}</Link> : inner}
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
