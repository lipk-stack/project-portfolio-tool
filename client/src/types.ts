export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type Health = 'green' | 'yellow' | 'red'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
export type RiskLevel = 'low' | 'medium' | 'high'
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'
export type SprintStatus = 'planned' | 'active' | 'completed'

export interface User {
  id: number
  email: string
  name: string
  role: string
  department?: string
  capacity: number
  hourly_rate: number
  avatar_url?: string
  created_at: string
}

export interface Portfolio {
  id: number
  name: string
  description?: string
  owner_id: number
  created_at: string
}

export interface Project {
  id: number
  portfolio_id?: number
  portfolio_name?: string
  name: string
  description?: string
  status: ProjectStatus
  priority: Priority
  health: Health
  phase?: string
  start_date?: string
  end_date?: string
  actual_start?: string
  actual_end?: string
  completion_percent: number
  budget: number
  spent: number
  manager_id?: number
  manager_name?: string
  color: string
  tags?: string
  created_at: string
  updated_at: string
  task_count?: number
  done_task_count?: number
  member_count?: number
  open_risk_count?: number
}

export interface Task {
  id: number
  project_id: number
  parent_id?: number
  name: string
  description?: string
  status: TaskStatus
  priority: Priority
  assignee_id?: number
  assignee_name?: string
  start_date?: string
  end_date?: string
  actual_start?: string
  actual_end?: string
  estimated_hours: number
  actual_hours: number
  completion_percent: number
  wbs_code?: string
  is_critical: number
  position: number
  sprint?: string
  story_points?: number
  tags?: string | string[]
  dependencies?: number[]
  children?: Task[]
  created_at: string
  updated_at: string
}

export interface Risk {
  id: number
  project_id: number
  title: string
  description?: string
  category: string
  probability: RiskLevel
  impact: RiskLevel
  score: number
  status: 'open' | 'mitigating' | 'closed'
  response?: string
  mitigation_plan?: string
  owner_id?: number
  owner_name?: string
  identified_date: string
  target_date?: string
  created_at: string
}

export interface BudgetLine {
  id: number
  project_id: number
  category: string
  description?: string
  planned_amount: number
  actual_amount: number
  period?: string
}

export interface TimeEntry {
  id: number
  task_id?: number
  task_name?: string
  user_id: number
  user_name?: string
  project_id: number
  project_name?: string
  project_color?: string
  hours: number
  date: string
  description?: string
  created_at: string
}

export interface Milestone {
  id: number
  project_id: number
  name: string
  date: string
  status: 'upcoming' | 'achieved' | 'missed'
  description?: string
  project_name?: string
  project_color?: string
}

export interface Comment {
  id: number
  entity_type: string
  entity_id: number
  user_id: number
  user_name: string
  user_email?: string
  content: string
  created_at: string
}

export interface Sprint {
  id: number
  project_id: number
  name: string
  goal?: string
  start_date?: string
  end_date?: string
  status: SprintStatus
  velocity: number
  total_tasks?: number
  done_tasks?: number
  total_points?: number
  completed_points?: number
  created_at: string
}

export interface Notification {
  id?: number
  type: string
  title: string
  message: string
  entity_type: string
  entity_id: number
  priority: 'high' | 'medium' | 'low'
  is_read?: number
  created_at: string
}

export interface ProjectTemplate {
  id: number
  name: string
  description?: string
  category: string
  template_data: string
  created_by?: number
  created_by_name?: string
  is_system: number
  created_at: string
}

export interface SearchResult {
  id: number
  name: string
  type: 'project' | 'task' | 'user' | 'risk'
  category: string
  status?: string
  priority?: string
  color?: string
  project_id?: number
  project_name?: string
  department?: string
  email?: string
  score?: number
}

export interface ActivityLog {
  id: number
  entity_type: string
  entity_id: number
  user_id: number
  user_name?: string
  action: string
  details?: string
  project_name?: string
  created_at: string
}

export interface ActivityItem extends ActivityLog {
  user_name?: string
  project_name?: string
}

export interface DashboardSummary {
  kpis: {
    totalProjects: number
    activeProjects: number
    onTrack: number
    atRisk: number
    behind: number
    completed: number
    totalBudget: number
    totalSpent: number
    budgetUtilization: number
    openRisks: number
    highRisks: number
    overdueTaskCount: number
    avgVelocity: number
  }
  upcomingMilestones: Milestone[]
  recentActivity: ActivityItem[]
  portfolioHealth: Array<Project & { manager_name?: string; task_count?: number; done_count?: number }>
  resourceUtilization: ResourceSummary[]
  weeklyHours: Array<{ date: string; total_hours: number }>
  healthTrend: Array<{ month: string; green: number; yellow: number; red: number }>
  insights: Array<{ type: string; title: string; message: string; severity: 'info' | 'warning' | 'critical' }>
}

export interface ResourceSummary {
  id: number
  name: string
  department?: string
  capacity: number
  total_allocation: number
  project_count: number
  projects?: Array<{
    project_id: number
    project_name: string
    allocation_percent: number
    color: string
    status: string
  }>
}

export interface JwtPayload {
  userId: number
  email: string
  role: string
}
