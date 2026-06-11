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
  email_notifications?: number
  created_at: string
}

export interface Webhook {
  id: number
  url: string
  events: string
  project_id: number | null
  project_name?: string
  enabled: number
  has_secret?: number
  last_status: number | null
  last_fired_at: string | null
  fail_count: number
  created_by_name?: string
  created_at: string
}

export interface ActivityEntry {
  id: number
  entity_type: string
  entity_id: number
  user_id: number | null
  user_name?: string
  project_name?: string
  action: string
  details: string | null
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
  baseline_start?: string
  baseline_end?: string
  baseline_budget?: number
  baseline_captured_at?: string
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
  baseline_start?: string
  baseline_end?: string
  baseline_hours?: number
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

export interface EVMMetrics {
  BAC: number; AC: number; EV: number; PV: number
  CV: number; SV: number
  CPI: number; SPI: number
  EAC: number; ETC: number; VAC: number; TCPI: number
  scheduleSlipDays: number
  completionPercent: number
  plannedPercent: number
}

export interface EVMResponse {
  project: { id: number; BAC: number; AC: number; EV: number; PV: number }
  metrics: EVMMetrics
  interpretation: { cost: string; schedule: string; health: Health }
  sCurve: Array<{ date: string; planned: number; earned: number; actual: number }>
  taskCount: number
}

export interface Comment {
  id: number
  entity_type: string
  entity_id: number
  user_id: number
  user_name: string
  user_email: string
  content: string
  created_at: string
}

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  message?: string
  link?: string
  read: number
  created_at: string
}

export interface CalendarEvent {
  id: number
  title: string
  date: string
  type: 'task' | 'milestone' | 'project-end'
  status?: string
  priority?: string
  is_critical?: number
  project_id: number
  project_name: string
  color: string
  assignee_name?: string
  health?: string
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

export interface CustomField {
  id: number
  project_id: number
  name: string
  field_type: 'text' | 'number' | 'select' | 'date'
  options: string[] | null
  position: number
  created_at: string
}

export interface ApiToken {
  id: number
  name: string
  prefix: string
  last_used_at?: string
  created_at: string
}

export interface ScenarioTaskResult {
  id: number
  name: string
  old_start: string | null
  old_end: string | null
  new_start: string | null
  new_end: string | null
  delta_days: number
  changed: boolean
  directly_changed: boolean
}

export interface ScenarioResult {
  tasks: ScenarioTaskResult[]
  summary: {
    old_end: string | null
    new_end: string | null
    end_delta_days: number
    old_cost: number
    new_cost: number
    cost_delta: number
  }
}
