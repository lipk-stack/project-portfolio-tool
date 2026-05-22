import { Code, Megaphone, Server, Rocket, FlaskConical, Building2 } from 'lucide-react'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: typeof Code
  color: string
  defaults: {
    status: string
    priority: string
    phase: string
    duration_weeks: number
    suggested_tasks: Array<{ name: string; estimated_hours: number }>
    suggested_milestones: Array<{ name: string; week: number }>
  }
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'software-dev',
    name: 'Software Development',
    description: 'Full software development lifecycle with sprints, testing, and deployment phases',
    category: 'Engineering',
    icon: Code,
    color: '#3b82f6',
    defaults: {
      status: 'planning',
      priority: 'high',
      phase: 'Planning',
      duration_weeks: 16,
      suggested_tasks: [
        { name: 'Requirements Gathering', estimated_hours: 20 },
        { name: 'System Architecture Design', estimated_hours: 40 },
        { name: 'Development Sprint 1', estimated_hours: 80 },
        { name: 'Development Sprint 2', estimated_hours: 80 },
        { name: 'Integration Testing', estimated_hours: 40 },
        { name: 'User Acceptance Testing', estimated_hours: 30 },
        { name: 'Documentation', estimated_hours: 20 },
        { name: 'Deployment & Go-Live', estimated_hours: 16 },
      ],
      suggested_milestones: [
        { name: 'Requirements Sign-off', week: 2 },
        { name: 'Architecture Approved', week: 4 },
        { name: 'Beta Release', week: 12 },
        { name: 'Production Launch', week: 16 },
      ],
    },
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    description: 'End-to-end campaign management from strategy to launch and analysis',
    category: 'Marketing',
    icon: Megaphone,
    color: '#f59e0b',
    defaults: {
      status: 'planning',
      priority: 'medium',
      phase: 'Strategy',
      duration_weeks: 12,
      suggested_tasks: [
        { name: 'Market Research', estimated_hours: 24 },
        { name: 'Campaign Strategy', estimated_hours: 16 },
        { name: 'Content Creation', estimated_hours: 60 },
        { name: 'Design Assets', estimated_hours: 40 },
        { name: 'Campaign Setup', estimated_hours: 20 },
        { name: 'Launch Execution', estimated_hours: 16 },
        { name: 'Performance Analysis', estimated_hours: 20 },
      ],
      suggested_milestones: [
        { name: 'Strategy Approved', week: 2 },
        { name: 'Content Delivered', week: 8 },
        { name: 'Campaign Launch', week: 10 },
        { name: 'Post-Campaign Report', week: 12 },
      ],
    },
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure Upgrade',
    description: 'Cloud migration, server upgrades, or network modernization projects',
    category: 'IT',
    icon: Server,
    color: '#8b5cf6',
    defaults: {
      status: 'planning',
      priority: 'critical',
      phase: 'Assessment',
      duration_weeks: 20,
      suggested_tasks: [
        { name: 'Current State Assessment', estimated_hours: 40 },
        { name: 'Target Architecture Design', estimated_hours: 60 },
        { name: 'Procurement & Setup', estimated_hours: 80 },
        { name: 'Data Migration', estimated_hours: 60 },
        { name: 'Testing & Validation', estimated_hours: 40 },
        { name: 'Cutover & Go-Live', estimated_hours: 24 },
        { name: 'Post-Migration Support', estimated_hours: 40 },
      ],
      suggested_milestones: [
        { name: 'Assessment Complete', week: 4 },
        { name: 'Design Approved', week: 6 },
        { name: 'Test Environment Ready', week: 12 },
        { name: 'Production Cutover', week: 18 },
        { name: 'Stabilization Complete', week: 20 },
      ],
    },
  },
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'Cross-functional product go-to-market planning and execution',
    category: 'Product',
    icon: Rocket,
    color: '#ec4899',
    defaults: {
      status: 'planning',
      priority: 'critical',
      phase: 'Planning',
      duration_weeks: 24,
      suggested_tasks: [
        { name: 'Product Positioning', estimated_hours: 20 },
        { name: 'Pricing Strategy', estimated_hours: 16 },
        { name: 'Sales Enablement', estimated_hours: 40 },
        { name: 'Marketing Materials', estimated_hours: 60 },
        { name: 'Partnership Outreach', estimated_hours: 30 },
        { name: 'Launch Event Planning', estimated_hours: 40 },
        { name: 'PR & Comms', estimated_hours: 30 },
        { name: 'Launch Day Execution', estimated_hours: 16 },
      ],
      suggested_milestones: [
        { name: 'Go-to-Market Plan Approved', week: 4 },
        { name: 'Sales Team Trained', week: 12 },
        { name: 'Press Embargo Lifts', week: 22 },
        { name: 'Product Launch', week: 24 },
      ],
    },
  },
  {
    id: 'research',
    name: 'Research Project',
    description: 'Structured research initiative with analysis, synthesis, and deliverables',
    category: 'Research',
    icon: FlaskConical,
    color: '#10b981',
    defaults: {
      status: 'planning',
      priority: 'medium',
      phase: 'Research',
      duration_weeks: 12,
      suggested_tasks: [
        { name: 'Literature Review', estimated_hours: 40 },
        { name: 'Research Design', estimated_hours: 20 },
        { name: 'Data Collection', estimated_hours: 60 },
        { name: 'Data Analysis', estimated_hours: 40 },
        { name: 'Findings Synthesis', estimated_hours: 30 },
        { name: 'Report Writing', estimated_hours: 40 },
        { name: 'Peer Review', estimated_hours: 20 },
      ],
      suggested_milestones: [
        { name: 'Research Plan Approved', week: 2 },
        { name: 'Data Collection Complete', week: 8 },
        { name: 'Draft Report Complete', week: 11 },
        { name: 'Final Report Published', week: 12 },
      ],
    },
  },
  {
    id: 'construction',
    name: 'Construction / Facilities',
    description: 'Physical construction, renovation, or facilities management project',
    category: 'Facilities',
    icon: Building2,
    color: '#f97316',
    defaults: {
      status: 'planning',
      priority: 'high',
      phase: 'Design',
      duration_weeks: 32,
      suggested_tasks: [
        { name: 'Site Assessment', estimated_hours: 24 },
        { name: 'Design & Permits', estimated_hours: 80 },
        { name: 'Contractor Selection', estimated_hours: 40 },
        { name: 'Foundation Work', estimated_hours: 120 },
        { name: 'Structural Construction', estimated_hours: 200 },
        { name: 'Interior Fit-out', estimated_hours: 160 },
        { name: 'Inspections & Sign-off', estimated_hours: 40 },
        { name: 'Commissioning', estimated_hours: 24 },
      ],
      suggested_milestones: [
        { name: 'Permits Approved', week: 6 },
        { name: 'Foundation Complete', week: 12 },
        { name: 'Structure Complete', week: 22 },
        { name: 'Final Inspection', week: 30 },
        { name: 'Handover', week: 32 },
      ],
    },
  },
]

interface ProjectTemplatesProps {
  onSelect: (template: ProjectTemplate) => void
  onDismiss: () => void
}

export default function ProjectTemplates({ onSelect, onDismiss }: ProjectTemplatesProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Start from a Template</h2>
          <p className="text-sm text-gray-500 mt-0.5">Choose a template to pre-fill your project structure</p>
        </div>
        <button onClick={onDismiss} className="text-sm text-gray-400 hover:text-gray-600">
          Start blank →
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROJECT_TEMPLATES.map(template => {
          const Icon = template.icon
          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="text-left p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: template.color + '20' }}
                >
                  <Icon size={20} style={{ color: template.color }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{template.name}</div>
                  <div className="text-xs text-gray-400">{template.category}</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{template.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <span>{template.defaults.suggested_tasks.length} tasks</span>
                <span>·</span>
                <span>{template.defaults.suggested_milestones.length} milestones</span>
                <span>·</span>
                <span>{template.defaults.duration_weeks}w est.</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
