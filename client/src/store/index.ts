import { create } from 'zustand'
import { User } from '../types'

// Initialize dark mode from localStorage
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark')
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },
  clearAuth: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null, isAuthenticated: false })
  },
}))

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>(set => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

interface ThemeState {
  darkMode: boolean
  toggleDarkMode: () => void
}

export const useThemeStore = create<ThemeState>(set => ({
  darkMode: localStorage.getItem('darkMode') === 'true',
  toggleDarkMode: () => set(s => {
    const next = !s.darkMode
    localStorage.setItem('darkMode', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    return { darkMode: next }
  }),
}))

interface NotificationState {
  unreadCount: number
  setUnreadCount: (n: number) => void
}

export const useNotificationStore = create<NotificationState>(set => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
}))
