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
  updatePreferences: (data: { email_notifications?: boolean }) => api.put('/auth/me/preferences', data),
}

export const webhooksApi = {
  list: () => api.get('/webhooks'),
  create: (data: { url: string; secret?: string; events: string[]; project_id?: number | null; format?: string }) => api.post('/webhooks', data),
  update: (id: number, data: object) => api.put(`/webhooks/${id}`, data),
  delete: (id: number) => api.delete(`/webhooks/${id}`),
  test: (id: number) => api.post(`/webhooks/${id}/test`),
}

export const activityApi = {
  list: (params?: { project_id?: number; user_id?: number; action?: string; limit?: number; offset?: number }) =>
    api.get('/activity', { params }),
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
  delete: (id: number) => api.delete(`/tasks/${id}`),
  addDependency: (id: number, data: object) => api.post(`/tasks/${id}/dependencies`, data),
  removeDependency: (id: number, predecessorId: number) => api.delete(`/tasks/${id}/dependencies/${predecessorId}`),
  logTime: (id: number, data: object) => api.post(`/tasks/${id}/time`, data),
  myWork: () => api.get('/tasks/my-work'),
  updateStatus: (id: number, status: string) => api.patch(`/tasks/${id}/status`, { status }),
}

export const resourcesApi = {
  list: () => api.get('/resources'),
  allocationMatrix: () => api.get('/resources/allocation-matrix'),
  utilization: () => api.get('/resources/utilization'),
  capacityForecast: (weeks = 12) => api.get('/resources/capacity-forecast', { params: { weeks } }),
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
  cashflow: (projectId: number) => api.get(`/budget/project/${projectId}/cashflow`),
  createLine: (projectId: number, data: object) => api.post(`/budget/project/${projectId}/lines`, data),
  updateLine: (id: number, data: object) => api.put(`/budget/lines/${id}`, data),
  deleteLine: (id: number) => api.delete(`/budget/lines/${id}`),
  portfolioOverview: () => api.get('/budget/portfolio/overview'),
}

export const reportsApi = {
  overview: () => api.get('/reports/overview'),
  resourceUtilization: () => api.get('/reports/resource-utilization'),
  criticalPath: (projectId: number) => api.get(`/reports/critical-path/${projectId}`),
  statusPdfUrl: (projectId: number) => `/api/reports/project/${projectId}/status.pdf`,
  portfolioPdfUrl: (portfolioId: number | 'all') => `/api/reports/portfolio/${portfolioId}/briefing.pdf`,
}

export const customFieldsApi = {
  list: (projectId: number) => api.get(`/custom-fields/project/${projectId}`),
  create: (projectId: number, data: { name: string; field_type: string; options?: string[] }) => api.post(`/custom-fields/project/${projectId}`, data),
  update: (id: number, data: object) => api.put(`/custom-fields/${id}`, data),
  delete: (id: number) => api.delete(`/custom-fields/${id}`),
  taskValues: (taskId: number) => api.get(`/custom-fields/task/${taskId}`),
}

export const scenarioApi = {
  simulate: (projectId: number, changes: Array<{ task_id: number; shift_days?: number; duration_delta_days?: number }>) =>
    api.post(`/scenario/project/${projectId}/simulate`, { changes }),
}

export const tokensApi = {
  list: () => api.get('/tokens'),
  create: (name: string) => api.post('/tokens', { name }),
  revoke: (id: number) => api.delete(`/tokens/${id}`),
}

export const automationsApi = {
  list: () => api.get('/automations'),
  create: (data: object) => api.post('/automations', data),
  update: (id: number, data: object) => api.put(`/automations/${id}`, data),
  toggle: (id: number) => api.post(`/automations/${id}/toggle`),
  delete: (id: number) => api.delete(`/automations/${id}`),
}

export const viewsApi = {
  list: (page: string) => api.get('/views', { params: { page } }),
  create: (data: { page: string; name: string; filters: object; is_default?: boolean }) => api.post('/views', data),
  update: (id: number, data: object) => api.put(`/views/${id}`, data),
  delete: (id: number) => api.delete(`/views/${id}`),
}

export const evmApi = {
  project: (id: number) => api.get(`/evm/project/${id}`),
  captureBaseline: (id: number) => api.post(`/evm/project/${id}/baseline`),
  clearBaseline: (id: number) => api.delete(`/evm/project/${id}/baseline`),
  portfolioSummary: () => api.get('/evm/portfolio/summary'),
}

export const sprintsApi = {
  list: (projectId: number) => api.get(`/sprints/project/${projectId}`),
  create: (projectId: number, data: object) => api.post(`/sprints/project/${projectId}`, data),
  update: (id: number, data: object) => api.put(`/sprints/${id}`, data),
  delete: (id: number) => api.delete(`/sprints/${id}`),
  assignTasks: (id: number, taskIds: number[]) => api.post(`/sprints/${id}/tasks`, { task_ids: taskIds }),
  unassignTask: (taskId: number) => api.delete(`/sprints/tasks/${taskId}`),
  burndown: (id: number) => api.get(`/sprints/${id}/burndown`),
  velocity: (projectId: number) => api.get(`/sprints/project/${projectId}/velocity`),
}

export const searchApi = {
  query: (q: string) => api.get('/search', { params: { q } }),
}

export const commentsApi = {
  list: (entityType: string, entityId: number) => api.get(`/comments/${entityType}/${entityId}`),
  add: (entityType: string, entityId: number, content: string) => api.post(`/comments/${entityType}/${entityId}`, { content }),
  delete: (id: number) => api.delete(`/comments/${id}`),
}

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

export const calendarApi = {
  events: (params?: { from?: string; to?: string; project_id?: number; user_id?: number }) => api.get('/calendar', { params }),
}

export const exportApi = {
  projectsCsv: () => '/api/export/projects.csv',
  projectTasksCsv: (id: number) => `/api/export/projects/${id}/tasks.csv`,
  projectRisksCsv: (id: number) => `/api/export/projects/${id}/risks.csv`,
  projectBudgetCsv: (id: number) => `/api/export/projects/${id}/budget.csv`,
  projectJson: (id: number) => `/api/export/projects/${id}.json`,
  timeEntriesCsv: (params?: { from?: string; to?: string; user_id?: number; project_id?: number }) => {
    const q = new URLSearchParams()
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    if (params?.user_id) q.set('user_id', String(params.user_id))
    if (params?.project_id) q.set('project_id', String(params.project_id))
    return `/api/export/time-entries.csv${q.toString() ? '?' + q.toString() : ''}`
  },
  downloadWithAuth: async (url: string, filename: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const blob = await res.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  },
}

export default api
