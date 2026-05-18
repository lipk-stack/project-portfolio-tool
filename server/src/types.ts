export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type Health = 'green' | 'yellow' | 'red'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
export type RiskLevel = 'low' | 'medium' | 'high'
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

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
  color: string
  tags?: string
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
  tags?: string
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
  user_id: number
  project_id: number
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
}

export interface Comment {
  id: number
  entity_type: string
  entity_id: number
  user_id: number
  content: string
  created_at: string
}

export interface ActivityLog {
  id: number
  entity_type: string
  entity_id: number
  user_id: number
  action: string
  details?: string
  created_at: string
}

export interface JwtPayload {
  userId: number
  email: string
  role: string
}
