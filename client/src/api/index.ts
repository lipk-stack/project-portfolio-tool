import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; department?: string }) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
}

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
}

export const portfoliosApi = {
  list: () => api.get('/portfolios'),
  get: (id: number) => api.get(`/portfolios/${id}`),
  create: (data: object) => api.post('/portfolios', data),
  update: (id: number, data: object) => api.put(`/portfolios/${id}`, data),
  delete: (id: number) => api.delete(`/portfolios/${id}`),
}

export const projectsApi = {
  list: (params?: object) => api.get('/projects', { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: object) => api.post('/projects', data),
  update: (id: number, data: object) => api.put(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  clone: (id: number, name?: string) => api.post(`/projects/${id}/clone`, { name }),
  getMembers: (id: number) => api.get(`/projects/${id}/members`),
  addMember: (id: number, data: object) => api.post(`/projects/${id}/members`, data),
  removeMember: (id: number, userId: number) => api.delete(`/projects/${id}/members/${userId}`),
  getMilestones: (id: number) => api.get(`/projects/${id}/milestones`),
  createMilestone: (id: number, data: object) => api.post(`/projects/${id}/milestones`, data),
  updateMilestone: (id: number, mid: number, data: object) => api.put(`/projects/${id}/milestones/${mid}`, data),
  deleteMilestone: (id: number, mid: number) => api.delete(`/projects/${id}/milestones/${mid}`),
  getActivity: (id: number) => api.get(`/projects/${id}/activity`),
}

export const tasksApi = {
  list: (projectId: number) => api.get(`/tasks/project/${projectId}`),
  create: (projectId: number, data: object) => api.post(`/tasks/project/${projectId}`, data),
  update: (id: number, data: object) => api.put(`/tasks/${id}`, data),
  bulkUpdate: (ids: number[], data: object) => api.patch('/tasks/bulk', { ids, ...data }),
  delete: (id: number) => api.delete(`/tasks/${id}`),
  addDependency: (id: number, data: object) => api.post(`/tasks/${id}/dependencies`, data),
  removeDependency: (id: number, predecessorId: number) => api.delete(`/tasks/${id}/dependencies/${predecessorId}`),
  logTime: (id: number, data: object) => api.post(`/tasks/${id}/time`, data),
}

export const resourcesApi = {
  list: () => api.get('/resources'),
  allocationMatrix: () => api.get('/resources/allocation-matrix'),
  utilization: () => api.get('/resources/utilization'),
  users: () => api.get('/resources/users'),
  getUser: (id: number) => api.get(`/resources/users/${id}`),
}

export const risksApi = {
  list: (projectId: number) => api.get(`/risks/project/${projectId}`),
  create: (projectId: number, data: object) => api.post(`/risks/project/${projectId}`, data),
  update: (id: number, data: object) => api.put(`/risks/${id}`, data),
  delete: (id: number) => api.delete(`/risks/${id}`),
  portfolioSummary: () => api.get('/risks/portfolio/summary'),
}

export const budgetApi = {
  get: (projectId: number) => api.get(`/budget/project/${projectId}`),
  createLine: (projectId: number, data: object) => api.post(`/budget/project/${projectId}/lines`, data),
  updateLine: (id: number, data: object) => api.put(`/budget/lines/${id}`, data),
  deleteLine: (id: number) => api.delete(`/budget/lines/${id}`),
  portfolioOverview: () => api.get('/budget/portfolio/overview'),
}

export const reportsApi = {
  overview: () => api.get('/reports/overview'),
  resourceUtilization: () => api.get('/reports/resource-utilization'),
  criticalPath: (projectId: number) => api.get(`/reports/critical-path/${projectId}`),
  evm: (projectId: number) => api.get(`/reports/evm/${projectId}`),
  insights: () => api.get('/reports/insights'),
  burndown: (projectId: number) => api.get(`/reports/burndown/${projectId}`),
}

export const timelineApi = {
  all: () => api.get('/timeline'),
}

export const searchApi = {
  search: (q: string) => api.get('/search', { params: { q } }),
}

export const timesheetsApi = {
  my: (week?: string) => api.get('/timesheets/my', { params: week ? { week } : {} }),
  team: (week?: string) => api.get('/timesheets/team', { params: week ? { week } : {} }),
  create: (data: object) => api.post('/timesheets', data),
  update: (id: number, data: object) => api.put(`/timesheets/${id}`, data),
  delete: (id: number) => api.delete(`/timesheets/${id}`),
}

export default api
