import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const SHORTCUTS: Record<string, string> = {
  d: '/',
  e: '/executive',
  p: '/portfolio',
  j: '/projects',
  m: '/my-tasks',
  r: '/roadmap',
  k: '/risks',
  t: '/resources',
  n: '/reports',
  s: '/settings',
}

export default function KeyboardNav() {
  const navigate = useNavigate()
  const pendingG = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (pendingG.current) {
        if (timer.current) clearTimeout(timer.current)
        pendingG.current = false
        const dest = SHORTCUTS[e.key.toLowerCase()]
        if (dest) {
          e.preventDefault()
          navigate(dest)
        }
        return
      }

      if (e.key.toLowerCase() === 'g') {
        pendingG.current = true
        timer.current = setTimeout(() => { pendingG.current = false }, 1000)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  return null
}
