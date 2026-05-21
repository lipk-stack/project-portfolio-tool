import { create } from 'zustand'
import { User } from '../types'

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
  darkMode: boolean
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

const storedDark = localStorage.getItem('darkMode') === 'true'
if (storedDark) document.documentElement.classList.add('dark')

export const useUIStore = create<UIState>(set => ({
  sidebarCollapsed: false,
  darkMode: storedDark,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleDarkMode: () => set(s => {
    const next = !s.darkMode
    localStorage.setItem('darkMode', String(next))
    document.documentElement.classList.toggle('dark', next)
    return { darkMode: next }
  }),
}))
