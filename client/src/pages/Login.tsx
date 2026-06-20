import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api'
import { useAuthStore } from '../store'

export default function Login() {
  const [email, setEmail] = useState('admin@demo.com')
  const [password, setPassword] = useState('admin123')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(email, password)
      setAuth(res.data.user, res.data.token)
      navigate('/')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const demoAccounts = [
    { email: 'admin@demo.com', password: 'admin123', role: 'Admin', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { email: 'john.manager@demo.com', password: 'demo123', role: 'PM', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { email: 'alex.dev@demo.com', password: 'demo123', role: 'Dev', color: 'bg-green-100 text-green-700 border-green-200' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500/5 rounded-full" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-500/5 rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Portia</h1>
          <p className="text-blue-200/70">Enterprise Portfolio Management</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-blue-200 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-blue-200/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 pr-10 text-white placeholder-blue-200/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/60 hover:text-blue-200">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors mt-2 disabled:opacity-50 shadow-lg shadow-blue-500/30"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-blue-200/60 mb-3 text-center">Quick access — demo accounts</p>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => { setEmail(acc.email); setPassword(acc.password) }}
                  className="text-center py-2 px-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <span className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${acc.color} mb-1`}>{acc.role}</span>
                  <div className="text-xs text-blue-200/60 truncate">{acc.email.split('@')[0]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-blue-200/40 text-xs mt-6">
          Portia v1.0 · Enterprise Portfolio Management
        </p>
      </div>
    </div>
  )
}
