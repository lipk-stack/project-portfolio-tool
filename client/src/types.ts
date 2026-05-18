export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type Health = 'green' | 'yellow' | 'red'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
export type RiskLevel = 'low' | 'medium' | 'high'

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
  owner_name?: string
  project_count?: number
  active_count?: number
  total_budget?: number
  total_spent?: number
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
  manager_email?: string
  color: string
  tags?: string[]
  task_count?: number
  done_task_count?: number
  member_count?: number
  open_risk_count?: number
  created_at: string
  updated_at: string
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
  assignee_email?: string
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
  tags: string[]
  subtask_count?: number
  done_subtask_count?: number
  dependencies: number[]
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

export interface ActivityItem {
  id: number
  entity_type: string
  entity_id: number
  user_id: number
  user_name: string
  user_email: string
  project_name?: string
  action: string
  details?: string
  created_at: string
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
  }
  upcomingMilestones: Milestone[]
  recentActivity: ActivityItem[]
  portfolioHealth: Project[]
  resourceUtilization: ResourceSummary[]
  weeklyHours: { date: string; total_hours: number }[]
}

export interface ResourceSummary {
  id: number
  name: string
  email: string
  department: string
  capacity: number
  total_allocation: number
  active_projects: number
  projects: Array<{
    project_id: number
    project_name: string
    color: string
    status: string
    role: string
    allocation_percent: number
  }>
  utilization_percent: number
}

export interface ProjectMember {
  id: number
  name: string
  email: string
  system_role: string
  department?: string
  role: string
  allocation_percent: number
}
