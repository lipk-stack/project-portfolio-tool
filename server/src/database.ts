import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/portfolio.db')
const dbDir = path.dirname(dbPath)

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

export const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      department TEXT,
      capacity INTEGER DEFAULT 40,
      hourly_rate REAL DEFAULT 0,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id INTEGER REFERENCES portfolios(id),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planning',
      priority TEXT DEFAULT 'medium',
      health TEXT DEFAULT 'green',
      phase TEXT,
      start_date DATE,
      end_date DATE,
      actual_start DATE,
      actual_end DATE,
      completion_percent INTEGER DEFAULT 0,
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      manager_id INTEGER REFERENCES users(id),
      color TEXT DEFAULT '#3B82F6',
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      date DATE NOT NULL,
      status TEXT DEFAULT 'upcoming',
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES tasks(id),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      assignee_id INTEGER REFERENCES users(id),
      start_date DATE,
      end_date DATE,
      actual_start DATE,
      actual_end DATE,
      estimated_hours REAL DEFAULT 0,
      actual_hours REAL DEFAULT 0,
      completion_percent INTEGER DEFAULT 0,
      wbs_code TEXT,
      is_critical INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      sprint TEXT,
      story_points INTEGER,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      predecessor_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      successor_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'FS',
      lag INTEGER DEFAULT 0,
      UNIQUE(predecessor_id, successor_id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      role TEXT DEFAULT 'member',
      allocation_percent INTEGER DEFAULT 100,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      probability TEXT DEFAULT 'medium',
      impact TEXT DEFAULT 'medium',
      score INTEGER DEFAULT 4,
      status TEXT DEFAULT 'open',
      response TEXT,
      mitigation_plan TEXT,
      owner_id INTEGER REFERENCES users(id),
      identified_date DATE DEFAULT CURRENT_DATE,
      target_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budget_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      description TEXT,
      planned_amount REAL DEFAULT 0,
      actual_amount REAL DEFAULT 0,
      period TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id),
      user_id INTEGER REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      hours REAL NOT NULL,
      date DATE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      goal TEXT,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'planning',
      capacity INTEGER DEFAULT 0,
      velocity INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'scope',
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      impact_schedule INTEGER DEFAULT 0,
      impact_budget REAL DEFAULT 0,
      impact_scope TEXT,
      requested_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      requested_date DATE DEFAULT CURRENT_DATE,
      decision_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'general',
      severity TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      assignee_id INTEGER REFERENCES users(id),
      reported_by INTEGER REFERENCES users(id),
      due_date DATE,
      resolved_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      baseline_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id),
      name TEXT NOT NULL,
      url TEXT,
      description TEXT,
      doc_type TEXT DEFAULT 'link',
      uploaded_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      icon TEXT DEFAULT '📋',
      tasks TEXT NOT NULL DEFAULT '[]',
      milestones TEXT NOT NULL DEFAULT '[]',
      duration_days INTEGER DEFAULT 90,
      created_by INTEGER REFERENCES users(id),
      is_builtin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  seedDatabase()
}

function seedDatabase() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (existing.count > 0) return

  const passwordHash = bcrypt.hashSync('demo123', 10)

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, department, capacity, hourly_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const users = db.transaction(() => {
    const ids: number[] = []
    const data = [
      ['admin@demo.com', bcrypt.hashSync('admin123', 10), 'Sarah Chen', 'admin', 'Executive', 40, 150],
      ['john.manager@demo.com', passwordHash, 'John Martinez', 'manager', 'Engineering', 40, 120],
      ['lisa.pm@demo.com', passwordHash, 'Lisa Thompson', 'manager', 'Product', 40, 115],
      ['alex.dev@demo.com', passwordHash, 'Alex Rivera', 'member', 'Engineering', 40, 95],
      ['emma.design@demo.com', passwordHash, 'Emma Wilson', 'member', 'Design', 40, 90],
      ['mike.dev@demo.com', passwordHash, 'Mike Johnson', 'member', 'Engineering', 40, 95],
      ['anna.qa@demo.com', passwordHash, 'Anna Schmidt', 'member', 'QA', 40, 85],
      ['david.data@demo.com', passwordHash, 'David Kim', 'member', 'Data', 40, 100],
      ['rachel.ux@demo.com', passwordHash, 'Rachel Patel', 'member', 'Design', 32, 88],
      ['tom.arch@demo.com', passwordHash, 'Tom Bradley', 'member', 'Architecture', 40, 130],
    ]
    for (const d of data) {
      const result = insertUser.run(...d as Parameters<typeof insertUser.run>)
      ids.push(result.lastInsertRowid as number)
    }
    return ids
  })()

  const insertPortfolio = db.prepare(`INSERT INTO portfolios (name, description, owner_id) VALUES (?, ?, ?)`)
  const p1 = insertPortfolio.run('Digital Transformation', 'Enterprise-wide digital transformation initiative', users[0])
  const p2 = insertPortfolio.run('Product Innovation', 'New product development portfolio', users[2])
  const portfolioId1 = p1.lastInsertRowid as number
  const portfolioId2 = p2.lastInsertRowid as number

  const insertProject = db.prepare(`
    INSERT INTO projects (portfolio_id, name, description, status, priority, health, phase,
      start_date, end_date, completion_percent, budget, spent, manager_id, color, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const projects = db.transaction(() => {
    const ids: number[] = []
    const data = [
      [portfolioId1, 'Customer Portal Redesign', 'Complete overhaul of the customer-facing portal with modern UX', 'active', 'high', 'green', 'execution', '2026-01-15', '2026-06-30', 65, 280000, 162000, users[1], '#3B82F6', '["ux","frontend","api"]'],
      [portfolioId1, 'ERP System Migration', 'Migrate legacy ERP to SAP S/4HANA cloud platform', 'active', 'critical', 'yellow', 'planning', '2026-02-01', '2026-12-31', 22, 1200000, 186000, users[1], '#8B5CF6', '["erp","migration","cloud"]'],
      [portfolioId1, 'Data Warehouse Modernization', 'Build scalable data warehouse on cloud infrastructure', 'active', 'high', 'green', 'execution', '2026-01-01', '2026-08-31', 48, 450000, 198000, users[2], '#10B981', '["data","cloud","analytics"]'],
      [portfolioId2, 'Mobile App v3.0', 'Next generation mobile application with AI features', 'active', 'high', 'red', 'execution', '2025-11-01', '2026-05-31', 78, 320000, 298000, users[2], '#F59E0B', '["mobile","ai","ios","android"]'],
      [portfolioId2, 'API Gateway Platform', 'Unified API gateway for all microservices', 'active', 'medium', 'green', 'monitoring', '2025-09-01', '2026-03-31', 92, 180000, 167000, users[1], '#06B6D4', '["api","infrastructure","devops"]'],
      [portfolioId1, 'Cybersecurity Enhancement', 'Zero-trust security architecture implementation', 'active', 'critical', 'yellow', 'planning', '2026-03-01', '2026-10-31', 15, 600000, 72000, users[0], '#EF4444', '["security","compliance","network"]'],
      [portfolioId2, 'Analytics Dashboard Suite', 'Executive and operational analytics dashboards', 'planning', 'medium', 'green', 'initiation', '2026-05-01', '2026-10-31', 5, 150000, 8000, users[2], '#84CC16', '["analytics","bi","visualization"]'],
      [portfolioId1, 'Cloud Infrastructure Upgrade', 'Kubernetes migration and multi-cloud strategy', 'completed', 'high', 'green', 'closure', '2025-06-01', '2026-02-28', 100, 380000, 362000, users[1], '#6366F1', '["cloud","kubernetes","devops"]'],
    ]
    for (const d of data) {
      const result = insertProject.run(...d as Parameters<typeof insertProject.run>)
      ids.push(result.lastInsertRowid as number)
    }
    return ids
  })()

  // Add project members
  const insertMember = db.prepare(`INSERT OR IGNORE INTO project_members (project_id, user_id, role, allocation_percent) VALUES (?, ?, ?, ?)`)
  const memberships = [
    [projects[0], users[3], 'developer', 80], [projects[0], users[4], 'designer', 100], [projects[0], users[6], 'qa', 50],
    [projects[1], users[3], 'developer', 60], [projects[1], users[9], 'architect', 100], [projects[1], users[7], 'analyst', 80],
    [projects[2], users[7], 'lead', 100], [projects[2], users[3], 'developer', 40], [projects[2], users[5], 'developer', 60],
    [projects[3], users[5], 'developer', 100], [projects[3], users[8], 'designer', 80], [projects[3], users[6], 'qa', 100],
    [projects[4], users[9], 'architect', 60], [projects[4], users[3], 'developer', 20],
    [projects[5], users[9], 'architect', 40], [projects[5], users[5], 'developer', 40],
    [projects[6], users[8], 'designer', 60], [projects[6], users[7], 'analyst', 50],
  ]
  db.transaction(() => { for (const m of memberships) insertMember.run(...m as Parameters<typeof insertMember.run>) })()

  // Tasks for Project 1 (Customer Portal)
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, parent_id, name, status, priority, assignee_id,
      start_date, end_date, estimated_hours, actual_hours, completion_percent, wbs_code, is_critical, position, story_points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const tasks = db.transaction(() => {
    const ids: number[] = []
    const data = [
      // Project 1 - Customer Portal
      [projects[0], null, 'Discovery & Planning', 'done', 'high', users[1], '2026-01-15', '2026-02-15', 120, 118, 100, '1.0', 0, 0, null],
      [projects[0], null, 'UI/UX Design', 'done', 'high', users[4], '2026-02-01', '2026-03-15', 200, 195, 100, '2.0', 1, 1, null],
      [projects[0], null, 'Frontend Development', 'in_progress', 'high', users[3], '2026-03-01', '2026-05-31', 320, 180, 60, '3.0', 1, 2, null],
      [projects[0], null, 'API Integration', 'in_progress', 'critical', users[3], '2026-03-15', '2026-05-15', 160, 80, 50, '4.0', 1, 3, null],
      [projects[0], null, 'QA & Testing', 'todo', 'high', users[6], '2026-05-15', '2026-06-15', 120, 0, 0, '5.0', 0, 4, null],
      [projects[0], null, 'Deployment & Launch', 'todo', 'critical', users[1], '2026-06-15', '2026-06-30', 40, 0, 0, '6.0', 1, 5, null],
      // Subtasks for Frontend Development
      [projects[0], null, 'Component Library', 'done', 'medium', users[4], '2026-03-01', '2026-03-20', 80, 76, 100, '3.1', 0, 6, 13],
      [projects[0], null, 'Dashboard Views', 'in_progress', 'high', users[3], '2026-03-20', '2026-04-30', 120, 60, 50, '3.2', 1, 7, 21],
      [projects[0], null, 'User Auth Flow', 'done', 'critical', users[3], '2026-03-01', '2026-03-15', 40, 38, 100, '3.3', 1, 8, 8],
      [projects[0], null, 'Profile & Settings', 'todo', 'low', users[3], '2026-05-01', '2026-05-20', 60, 0, 0, '3.4', 0, 9, 5],
      // Project 2 - ERP Migration
      [projects[1], null, 'Current State Assessment', 'done', 'critical', users[9], '2026-02-01', '2026-03-01', 160, 168, 100, '1.0', 1, 0, null],
      [projects[1], null, 'SAP License & Infrastructure', 'in_progress', 'critical', users[9], '2026-03-01', '2026-04-30', 80, 40, 50, '2.0', 1, 1, null],
      [projects[1], null, 'Data Migration Planning', 'in_progress', 'high', users[7], '2026-03-15', '2026-06-30', 240, 60, 25, '3.0', 1, 2, null],
      [projects[1], null, 'Module Configuration', 'todo', 'high', users[9], '2026-05-01', '2026-09-30', 400, 0, 0, '4.0', 1, 3, null],
      [projects[1], null, 'UAT & Training', 'todo', 'high', users[3], '2026-10-01', '2026-11-30', 200, 0, 0, '5.0', 0, 4, null],
      // Project 3 - Data Warehouse
      [projects[2], null, 'Architecture Design', 'done', 'high', users[7], '2026-01-01', '2026-02-01', 120, 115, 100, '1.0', 1, 0, null],
      [projects[2], null, 'Data Ingestion Pipeline', 'done', 'high', users[7], '2026-02-01', '2026-03-31', 200, 195, 100, '2.0', 1, 1, null],
      [projects[2], null, 'Transformation Layer', 'in_progress', 'high', users[5], '2026-03-15', '2026-05-31', 240, 100, 42, '3.0', 1, 2, null],
      [projects[2], null, 'BI Reporting Layer', 'in_progress', 'medium', users[7], '2026-05-01', '2026-07-31', 180, 20, 11, '4.0', 0, 3, null],
      [projects[2], null, 'Performance Optimization', 'todo', 'medium', users[5], '2026-07-01', '2026-08-31', 80, 0, 0, '5.0', 0, 4, null],
      // Project 4 - Mobile App
      [projects[3], null, 'AI Feature Design', 'done', 'critical', users[8], '2025-11-01', '2025-12-15', 120, 122, 100, '1.0', 1, 0, null],
      [projects[3], null, 'iOS Development', 'in_progress', 'high', users[5], '2025-12-01', '2026-04-30', 400, 340, 85, '2.0', 1, 1, null],
      [projects[3], null, 'Android Development', 'in_progress', 'high', users[5], '2025-12-01', '2026-04-30', 400, 340, 85, '3.0', 1, 2, null],
      [projects[3], null, 'Backend API', 'done', 'critical', users[3], '2025-11-15', '2026-02-28', 280, 285, 100, '4.0', 1, 3, null],
      [projects[3], null, 'QA & Beta Testing', 'in_progress', 'high', users[6], '2026-03-01', '2026-05-15', 160, 80, 50, '5.0', 0, 4, null],
      [projects[3], null, 'App Store Submission', 'todo', 'critical', users[2], '2026-05-15', '2026-05-31', 20, 0, 0, '6.0', 1, 5, null],
    ]
    for (const d of data) {
      const result = insertTask.run(...d as Parameters<typeof insertTask.run>)
      ids.push(result.lastInsertRowid as number)
    }
    return ids
  })()

  // Task dependencies
  const insertDep = db.prepare(`INSERT OR IGNORE INTO task_dependencies (predecessor_id, successor_id, type) VALUES (?, ?, ?)`)
  db.transaction(() => {
    insertDep.run(tasks[0], tasks[1], 'FS')
    insertDep.run(tasks[1], tasks[2], 'FS')
    insertDep.run(tasks[2], tasks[4], 'FS')
    insertDep.run(tasks[3], tasks[4], 'FS')
    insertDep.run(tasks[4], tasks[5], 'FS')
    insertDep.run(tasks[10], tasks[11], 'FS')
    insertDep.run(tasks[11], tasks[12], 'FS')
    insertDep.run(tasks[12], tasks[13], 'FS')
    insertDep.run(tasks[13], tasks[14], 'FS')
    insertDep.run(tasks[15], tasks[16], 'FS')
    insertDep.run(tasks[16], tasks[17], 'FS')
    insertDep.run(tasks[17], tasks[18], 'FS')
    insertDep.run(tasks[20], tasks[21], 'FS')
    insertDep.run(tasks[23], tasks[24], 'FS')
    insertDep.run(tasks[24], tasks[25], 'FS')
  })()

  // Milestones
  const insertMilestone = db.prepare(`INSERT INTO milestones (project_id, name, date, status, description) VALUES (?, ?, ?, ?, ?)`)
  db.transaction(() => {
    insertMilestone.run(projects[0], 'Design Approval', '2026-03-15', 'achieved', 'All UI designs signed off by stakeholders')
    insertMilestone.run(projects[0], 'Beta Release', '2026-06-01', 'upcoming', 'Internal beta testing begins')
    insertMilestone.run(projects[0], 'Go Live', '2026-06-30', 'upcoming', 'Production deployment')
    insertMilestone.run(projects[1], 'Infrastructure Ready', '2026-04-30', 'upcoming', 'SAP environment fully provisioned')
    insertMilestone.run(projects[1], 'Data Migration Complete', '2026-09-30', 'upcoming', 'All data migrated and validated')
    insertMilestone.run(projects[2], 'Pipeline Operational', '2026-04-01', 'achieved', 'All data pipelines running in production')
    insertMilestone.run(projects[3], 'App Store Launch', '2026-05-31', 'upcoming', 'iOS and Android app store release')
    insertMilestone.run(projects[4], 'v1.0 Release', '2026-01-31', 'achieved', 'API Gateway v1.0 deployed')
    insertMilestone.run(projects[5], 'Security Audit', '2026-06-30', 'upcoming', 'External security audit completion')
  })()

  // Risks
  const insertRisk = db.prepare(`
    INSERT INTO risks (project_id, title, description, category, probability, impact, score, status, response, mitigation_plan, owner_id, identified_date, target_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    insertRisk.run(projects[0], 'Third-party API instability', 'Payment gateway API has had 3 outages this quarter', 'technical', 'medium', 'high', 6, 'mitigating', 'mitigate', 'Implement retry logic and fallback payment provider', users[3], '2026-02-01', '2026-04-30')
    insertRisk.run(projects[0], 'Scope creep', 'Stakeholders requesting additional features mid-sprint', 'schedule', 'high', 'medium', 6, 'open', 'avoid', 'Strict change control process, weekly stakeholder alignment', users[1], '2026-01-20', '2026-03-31')
    insertRisk.run(projects[1], 'Key SAP consultant availability', 'Only one certified SAP architect on the team', 'resource', 'high', 'high', 9, 'open', 'mitigate', 'Hire second SAP consultant, document all architecture decisions', users[9], '2026-02-10', '2026-03-15')
    insertRisk.run(projects[1], 'Data quality issues', 'Legacy data has inconsistencies affecting migration', 'technical', 'high', 'critical', 9, 'mitigating', 'mitigate', 'Data cleansing project running in parallel', users[7], '2026-02-15', '2026-05-31')
    insertRisk.run(projects[1], 'License cost overrun', 'SAP license costs may exceed budget estimate', 'budget', 'medium', 'high', 6, 'open', 'accept', 'Monitor license usage, negotiate volume discounts', users[0], '2026-03-01', '2026-06-30')
    insertRisk.run(projects[2], 'Cloud cost escalation', 'Data processing costs higher than projected', 'budget', 'medium', 'medium', 4, 'mitigating', 'mitigate', 'Implement cost monitoring and auto-scaling policies', users[7], '2026-02-01', '2026-04-30')
    insertRisk.run(projects[3], 'App store rejection', 'iOS/Android store may reject app for policy violations', 'external', 'low', 'high', 3, 'open', 'mitigate', 'Pre-submission review against store guidelines', users[2], '2026-01-15', '2026-05-01')
    insertRisk.run(projects[3], 'Over budget', 'Project has spent 93% of budget at 78% completion', 'budget', 'high', 'high', 9, 'open', 'accept', 'Request budget increase or reduce remaining scope', users[2], '2026-04-01', '2026-05-15')
    insertRisk.run(projects[5], 'Regulatory compliance gap', 'Current security posture may not meet ISO 27001', 'external', 'medium', 'critical', 8, 'open', 'mitigate', 'Engage compliance consultant, gap analysis underway', users[0], '2026-03-05', '2026-05-31')
  })()

  // Budget lines
  const insertBudget = db.prepare(`INSERT INTO budget_lines (project_id, category, description, planned_amount, actual_amount, period) VALUES (?, ?, ?, ?, ?, ?)`)
  db.transaction(() => {
    insertBudget.run(projects[0], 'labor', 'Development team', 180000, 108000, '2026')
    insertBudget.run(projects[0], 'labor', 'Design team', 60000, 42000, '2026')
    insertBudget.run(projects[0], 'software', 'Licenses & tools', 20000, 8000, '2026')
    insertBudget.run(projects[0], 'infrastructure', 'Cloud hosting', 15000, 3000, '2026')
    insertBudget.run(projects[0], 'other', 'Training & misc', 5000, 1000, '2026')

    insertBudget.run(projects[1], 'labor', 'SAP consultants', 600000, 80000, '2026')
    insertBudget.run(projects[1], 'labor', 'Internal team', 200000, 30000, '2026')
    insertBudget.run(projects[1], 'software', 'SAP licenses', 280000, 60000, '2026')
    insertBudget.run(projects[1], 'infrastructure', 'Cloud infrastructure', 80000, 10000, '2026')
    insertBudget.run(projects[1], 'other', 'Training & change mgmt', 40000, 6000, '2026')

    insertBudget.run(projects[2], 'labor', 'Data engineering team', 280000, 135000, '2026')
    insertBudget.run(projects[2], 'infrastructure', 'Cloud data services', 120000, 48000, '2026')
    insertBudget.run(projects[2], 'software', 'BI tools licenses', 40000, 12000, '2026')
    insertBudget.run(projects[2], 'other', 'Training', 10000, 3000, '2026')

    insertBudget.run(projects[3], 'labor', 'Mobile dev team', 240000, 228000, '2026')
    insertBudget.run(projects[3], 'labor', 'QA team', 40000, 30000, '2026')
    insertBudget.run(projects[3], 'software', 'Dev tools & subscriptions', 20000, 18000, '2026')
    insertBudget.run(projects[3], 'infrastructure', 'Backend infrastructure', 15000, 17000, '2026')
    insertBudget.run(projects[3], 'other', 'App store fees', 5000, 5000, '2026')
  })()

  // Time entries (recent 30 days)
  const insertTime = db.prepare(`INSERT INTO time_entries (task_id, user_id, project_id, hours, date, description) VALUES (?, ?, ?, ?, ?, ?)`)
  const timeEntries = [
    [tasks[2], users[3], projects[0], 8, '2026-05-15', 'Dashboard component development'],
    [tasks[2], users[3], projects[0], 7.5, '2026-05-14', 'API integration for dashboard'],
    [tasks[3], users[3], projects[0], 6, '2026-05-13', 'Payment API integration'],
    [tasks[7], users[4], projects[0], 8, '2026-05-15', 'UI components for dashboard'],
    [tasks[17], users[5], projects[2], 8, '2026-05-15', 'Data transformation pipeline'],
    [tasks[18], users[7], projects[2], 7, '2026-05-15', 'BI dashboard development'],
    [tasks[21], users[5], projects[3], 8, '2026-05-15', 'iOS bug fixes'],
    [tasks[22], users[5], projects[3], 8, '2026-05-14', 'Android optimization'],
    [tasks[11], users[9], projects[1], 6, '2026-05-15', 'SAP infrastructure setup'],
    [tasks[12], users[7], projects[1], 8, '2026-05-15', 'Data mapping documentation'],
  ]
  db.transaction(() => { for (const t of timeEntries) insertTime.run(...t as Parameters<typeof insertTime.run>) })()

  // Sprints
  const insertSprint = db.prepare(`INSERT INTO sprints (project_id, name, goal, start_date, end_date, status, capacity, velocity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  const sprints = db.transaction(() => {
    const ids: number[] = []
    const data = [
      [projects[0], 'Sprint 1', 'Complete discovery and initial design', '2026-01-15', '2026-01-29', 'completed', 80, 47],
      [projects[0], 'Sprint 2', 'Finalize UI/UX and start frontend dev', '2026-01-29', '2026-02-12', 'completed', 80, 55],
      [projects[0], 'Sprint 3', 'Core frontend components and auth flow', '2026-02-12', '2026-02-26', 'completed', 80, 42],
      [projects[0], 'Sprint 4', 'Dashboard views and API integration', '2026-02-26', '2026-03-12', 'active', 80, 38],
      [projects[0], 'Sprint 5', 'QA and launch preparation', '2026-03-12', '2026-03-26', 'planning', 80, 0],
      [projects[3], 'Sprint 1', 'AI feature design and backend API', '2025-11-01', '2025-11-15', 'completed', 60, 34],
      [projects[3], 'Sprint 2', 'iOS and Android foundation', '2025-11-15', '2025-11-29', 'completed', 60, 55],
      [projects[3], 'Sprint 3', 'Core features implementation', '2025-11-29', '2025-12-13', 'completed', 60, 60],
      [projects[3], 'Sprint 4', 'Beta testing and bug fixes', '2025-12-13', '2025-12-27', 'active', 60, 44],
    ]
    for (const d of data) {
      const result = insertSprint.run(...d as Parameters<typeof insertSprint.run>)
      ids.push(result.lastInsertRowid as number)
    }
    return ids
  })()

  // Change Requests
  const insertCR = db.prepare(`INSERT INTO change_requests (project_id, title, description, type, status, priority, impact_schedule, impact_budget, impact_scope, requested_by, approved_by, requested_date, decision_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  db.transaction(() => {
    insertCR.run(projects[0], 'Add payment history export feature', 'Stakeholder requested CSV export of payment history for finance team', 'scope', 'approved', 'medium', 5, 8000, 'New export module, CSV generation', users[1], users[0], '2026-02-15', '2026-02-22')
    insertCR.run(projects[0], 'Integrate with CRM system', 'Marketing wants bidirectional CRM sync for customer data', 'scope', 'pending', 'high', 14, 25000, 'New CRM integration module, API connectors', users[1], null, '2026-03-01', null)
    insertCR.run(projects[1], 'Extend project timeline by 2 months', 'Data quality issues causing delays in migration planning phase', 'schedule', 'approved', 'critical', 60, 180000, null, users[9], users[0], '2026-03-10', '2026-03-15')
    insertCR.run(projects[1], 'Add custom reporting module', 'Finance team needs custom SAP reports beyond standard ones', 'scope', 'rejected', 'medium', 21, 45000, 'Custom report builder module', users[7], users[0], '2026-02-20', '2026-02-28')
    insertCR.run(projects[3], 'Add Apple Watch companion app', 'Product team wants WatchOS companion', 'scope', 'pending', 'low', 30, 60000, 'New WatchOS target and UI', users[2], null, '2026-04-01', null)
    insertCR.run(projects[3], 'Increase backend infrastructure capacity', 'Load testing showed need for 3x current capacity', 'budget', 'approved', 'high', 0, 12000, null, users[5], users[2], '2026-03-20', '2026-03-25')
  })()

  // Issues
  const insertIssue = db.prepare(`INSERT INTO issues (project_id, title, description, type, severity, status, assignee_id, reported_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  db.transaction(() => {
    insertIssue.run(projects[0], 'SSO integration broken in staging', 'Single sign-on fails with SAML assertion error in staging environment', 'bug', 'high', 'open', users[3], users[6], '2026-05-20')
    insertIssue.run(projects[0], 'Performance degradation on dashboard load', 'Dashboard takes 8+ seconds to load with 1000+ records', 'performance', 'medium', 'in_progress', users[3], users[4], '2026-05-25')
    insertIssue.run(projects[1], 'Data mapping inconsistency in module 3', 'GL account codes not mapping correctly from legacy to SAP', 'data', 'critical', 'open', users[7], users[9], '2026-05-18')
    insertIssue.run(projects[1], 'Training materials outdated', 'Training docs reflect old system screens, need update', 'documentation', 'low', 'open', users[3], users[7], '2026-06-01')
    insertIssue.run(projects[3], 'iOS crash on older devices', 'App crashes on iPhone X and earlier when accessing camera', 'bug', 'critical', 'in_progress', users[5], users[6], '2026-05-22')
    insertIssue.run(projects[3], 'Push notifications not delivering on Android 12', 'FCM notifications not received on Android 12 devices', 'bug', 'high', 'open', users[5], users[6], '2026-05-25')
    insertIssue.run(projects[2], 'Cloud cost 40% over budget for data processing', 'Spark jobs consuming more compute than estimated', 'budget', 'high', 'in_progress', users[7], users[7], '2026-05-30')
  })()

  // Notifications
  const insertNotif = db.prepare(`INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, read) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  db.transaction(() => {
    insertNotif.run(users[0], 'risk_alert', 'High risk identified: SAP consultant availability', 'Project ERP Migration has a critical risk with no mitigation plan', 'project', projects[1], 0)
    insertNotif.run(users[0], 'budget_alert', 'Mobile App v3.0 budget at 93%', 'Project has spent $298K of $320K budget at 78% completion', 'project', projects[3], 0)
    insertNotif.run(users[0], 'milestone_due', 'Milestone due in 3 days: App Store Launch', 'App Store Submission milestone is approaching for Mobile App v3.0', 'project', projects[3], 0)
    insertNotif.run(users[1], 'task_assigned', 'You have been assigned a task', 'Deployment & Launch task is assigned to you in Customer Portal Redesign', 'task', tasks[5], 0)
    insertNotif.run(users[1], 'cr_pending', 'Change Request pending your review', 'CRM Integration CR needs your decision in Customer Portal Redesign', 'project', projects[0], 0)
    insertNotif.run(users[3], 'issue_assigned', 'Issue assigned to you: SSO integration broken', 'High severity bug in Customer Portal Redesign needs your attention', 'project', projects[0], 0)
    insertNotif.run(users[3], 'task_overdue', 'Task overdue: Dashboard Views', 'Dashboard Views task is past its due date', 'task', tasks[7], 1)
    insertNotif.run(users[5], 'issue_assigned', 'Critical iOS crash assigned to you', 'Investigate and fix iOS crash on older devices immediately', 'project', projects[3], 0)
  })()

  // Activity log
  const insertActivity = db.prepare(`INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)`)
  db.transaction(() => {
    insertActivity.run('project', projects[0], users[3], 'status_updated', JSON.stringify({ from: 'in_progress', to: 'done', field: 'Component Library' }))
    insertActivity.run('project', projects[0], users[4], 'comment_added', JSON.stringify({ message: 'Design handoff complete for all dashboard views' }))
    insertActivity.run('project', projects[1], users[9], 'risk_raised', JSON.stringify({ risk: 'SAP consultant availability concern' }))
    insertActivity.run('project', projects[3], users[5], 'milestone_approaching', JSON.stringify({ milestone: 'App Store Launch', daysLeft: 13 }))
    insertActivity.run('project', projects[2], users[7], 'task_completed', JSON.stringify({ task: 'Data Ingestion Pipeline' }))
    insertActivity.run('project', projects[0], users[1], 'budget_updated', JSON.stringify({ note: 'Approved additional $20k for performance optimization' }))
    insertActivity.run('project', projects[3], users[2], 'health_changed', JSON.stringify({ from: 'yellow', to: 'red', reason: 'Budget overrun risk' }))
  })()

  // Built-in Project Templates
  const insertTemplate = db.prepare(`INSERT INTO project_templates (name, description, category, icon, tasks, milestones, duration_days, is_builtin) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`)
  db.transaction(() => {
    insertTemplate.run(
      'Software Development', 'Standard software development lifecycle template', 'technology', '💻',
      JSON.stringify([
        { name: 'Requirements Gathering', status: 'todo', priority: 'high', estimated_hours: 16, wbs_code: '1.0' },
        { name: 'System Architecture Design', status: 'todo', priority: 'high', estimated_hours: 24, wbs_code: '2.0' },
        { name: 'Database Design', status: 'todo', priority: 'medium', estimated_hours: 16, wbs_code: '2.1' },
        { name: 'API Design & Documentation', status: 'todo', priority: 'medium', estimated_hours: 20, wbs_code: '2.2' },
        { name: 'Frontend Development', status: 'todo', priority: 'high', estimated_hours: 80, wbs_code: '3.0' },
        { name: 'Backend Development', status: 'todo', priority: 'high', estimated_hours: 80, wbs_code: '3.1' },
        { name: 'Unit Testing', status: 'todo', priority: 'medium', estimated_hours: 40, wbs_code: '4.0' },
        { name: 'Integration Testing', status: 'todo', priority: 'medium', estimated_hours: 32, wbs_code: '4.1' },
        { name: 'User Acceptance Testing', status: 'todo', priority: 'high', estimated_hours: 24, wbs_code: '4.2' },
        { name: 'Deployment & Go-Live', status: 'todo', priority: 'critical', estimated_hours: 16, wbs_code: '5.0' },
        { name: 'Post-Launch Support', status: 'todo', priority: 'medium', estimated_hours: 40, wbs_code: '6.0' },
      ]),
      JSON.stringify([
        { name: 'Requirements Sign-off', offset_days: 14 },
        { name: 'Architecture Approved', offset_days: 28 },
        { name: 'Development Complete', offset_days: 60 },
        { name: 'UAT Complete', offset_days: 75 },
        { name: 'Go-Live', offset_days: 90 },
      ]),
      90
    )
    insertTemplate.run(
      'Marketing Campaign', 'End-to-end marketing campaign launch template', 'marketing', '📢',
      JSON.stringify([
        { name: 'Campaign Strategy & Brief', status: 'todo', priority: 'high', estimated_hours: 12, wbs_code: '1.0' },
        { name: 'Market Research & Analysis', status: 'todo', priority: 'high', estimated_hours: 20, wbs_code: '1.1' },
        { name: 'Target Audience Definition', status: 'todo', priority: 'medium', estimated_hours: 8, wbs_code: '1.2' },
        { name: 'Creative Brief & Concept', status: 'todo', priority: 'high', estimated_hours: 16, wbs_code: '2.0' },
        { name: 'Content Creation', status: 'todo', priority: 'high', estimated_hours: 40, wbs_code: '3.0' },
        { name: 'Visual Design Assets', status: 'todo', priority: 'medium', estimated_hours: 32, wbs_code: '3.1' },
        { name: 'Social Media Setup', status: 'todo', priority: 'medium', estimated_hours: 8, wbs_code: '4.0' },
        { name: 'Email Campaign Setup', status: 'todo', priority: 'medium', estimated_hours: 12, wbs_code: '4.1' },
        { name: 'Paid Advertising Setup', status: 'todo', priority: 'high', estimated_hours: 16, wbs_code: '4.2' },
        { name: 'Campaign Launch', status: 'todo', priority: 'critical', estimated_hours: 4, wbs_code: '5.0' },
        { name: 'Performance Monitoring', status: 'todo', priority: 'medium', estimated_hours: 20, wbs_code: '6.0' },
        { name: 'Campaign Report & Analysis', status: 'todo', priority: 'medium', estimated_hours: 12, wbs_code: '7.0' },
      ]),
      JSON.stringify([
        { name: 'Strategy Approved', offset_days: 7 },
        { name: 'Creative Assets Ready', offset_days: 21 },
        { name: 'Channels Activated', offset_days: 28 },
        { name: 'Campaign Launch', offset_days: 30 },
        { name: 'Final Report', offset_days: 60 },
      ]),
      60
    )
    insertTemplate.run(
      'Product Launch', 'New product go-to-market launch template', 'product', '🚀',
      JSON.stringify([
        { name: 'Product Vision & Roadmap', status: 'todo', priority: 'high', estimated_hours: 16, wbs_code: '1.0' },
        { name: 'Market & Competitor Analysis', status: 'todo', priority: 'high', estimated_hours: 24, wbs_code: '1.1' },
        { name: 'MVP Feature Definition', status: 'todo', priority: 'critical', estimated_hours: 20, wbs_code: '2.0' },
        { name: 'UX Research & Prototyping', status: 'todo', priority: 'high', estimated_hours: 40, wbs_code: '2.1' },
        { name: 'Product Development', status: 'todo', priority: 'critical', estimated_hours: 120, wbs_code: '3.0' },
        { name: 'Beta Testing Program', status: 'todo', priority: 'high', estimated_hours: 32, wbs_code: '4.0' },
        { name: 'Go-to-Market Strategy', status: 'todo', priority: 'high', estimated_hours: 20, wbs_code: '5.0' },
        { name: 'Pricing & Packaging', status: 'todo', priority: 'medium', estimated_hours: 16, wbs_code: '5.1' },
        { name: 'Sales Enablement', status: 'todo', priority: 'medium', estimated_hours: 24, wbs_code: '5.2' },
        { name: 'Marketing Launch Campaign', status: 'todo', priority: 'high', estimated_hours: 40, wbs_code: '6.0' },
        { name: 'Launch Day Execution', status: 'todo', priority: 'critical', estimated_hours: 8, wbs_code: '7.0' },
        { name: 'Post-Launch Review', status: 'todo', priority: 'medium', estimated_hours: 16, wbs_code: '8.0' },
      ]),
      JSON.stringify([
        { name: 'MVP Defined', offset_days: 14 },
        { name: 'Beta Launch', offset_days: 60 },
        { name: 'GTM Strategy Ready', offset_days: 75 },
        { name: 'Product Launch', offset_days: 90 },
        { name: '30-day Review', offset_days: 120 },
      ]),
      120
    )
    insertTemplate.run(
      'Data Analytics Project', 'Analytics and business intelligence implementation', 'data', '📊',
      JSON.stringify([
        { name: 'Business Requirements Gathering', status: 'todo', priority: 'high', estimated_hours: 20, wbs_code: '1.0' },
        { name: 'Data Audit & Assessment', status: 'todo', priority: 'high', estimated_hours: 24, wbs_code: '1.1' },
        { name: 'Data Architecture Design', status: 'todo', priority: 'high', estimated_hours: 32, wbs_code: '2.0' },
        { name: 'ETL Pipeline Development', status: 'todo', priority: 'high', estimated_hours: 60, wbs_code: '3.0' },
        { name: 'Data Warehouse Setup', status: 'todo', priority: 'high', estimated_hours: 40, wbs_code: '3.1' },
        { name: 'Data Quality Rules', status: 'todo', priority: 'medium', estimated_hours: 24, wbs_code: '3.2' },
        { name: 'Dashboard Development', status: 'todo', priority: 'high', estimated_hours: 48, wbs_code: '4.0' },
        { name: 'Report Creation', status: 'todo', priority: 'medium', estimated_hours: 32, wbs_code: '4.1' },
        { name: 'User Training', status: 'todo', priority: 'medium', estimated_hours: 20, wbs_code: '5.0' },
        { name: 'Go-Live & Handover', status: 'todo', priority: 'critical', estimated_hours: 16, wbs_code: '6.0' },
      ]),
      JSON.stringify([
        { name: 'Architecture Approved', offset_days: 21 },
        { name: 'ETL Complete', offset_days: 45 },
        { name: 'Dashboards Ready', offset_days: 60 },
        { name: 'Training Complete', offset_days: 70 },
        { name: 'Go-Live', offset_days: 75 },
      ]),
      75
    )
    insertTemplate.run(
      'Office Move / Relocation', 'Office relocation project plan template', 'operations', '🏢',
      JSON.stringify([
        { name: 'Relocation Planning & Timeline', status: 'todo', priority: 'high', estimated_hours: 16, wbs_code: '1.0' },
        { name: 'New Space Assessment', status: 'todo', priority: 'high', estimated_hours: 8, wbs_code: '1.1' },
        { name: 'Vendor Selection (Moving Company)', status: 'todo', priority: 'medium', estimated_hours: 12, wbs_code: '2.0' },
        { name: 'IT Infrastructure Planning', status: 'todo', priority: 'critical', estimated_hours: 24, wbs_code: '2.1' },
        { name: 'Space Design & Layout', status: 'todo', priority: 'medium', estimated_hours: 20, wbs_code: '3.0' },
        { name: 'Furniture & Equipment Ordering', status: 'todo', priority: 'medium', estimated_hours: 12, wbs_code: '3.1' },
        { name: 'Staff Communication Plan', status: 'todo', priority: 'high', estimated_hours: 8, wbs_code: '4.0' },
        { name: 'IT Setup at New Location', status: 'todo', priority: 'critical', estimated_hours: 32, wbs_code: '5.0' },
        { name: 'Physical Move Execution', status: 'todo', priority: 'critical', estimated_hours: 24, wbs_code: '6.0' },
        { name: 'Post-Move Setup & Testing', status: 'todo', priority: 'high', estimated_hours: 16, wbs_code: '7.0' },
      ]),
      JSON.stringify([
        { name: 'Vendor Contracts Signed', offset_days: 14 },
        { name: 'Space Ready', offset_days: 35 },
        { name: 'IT Infrastructure Live', offset_days: 42 },
        { name: 'Move Complete', offset_days: 45 },
        { name: 'Operations Normal', offset_days: 50 },
      ]),
      50
    )
  })()

  console.log('Database seeded successfully with demo data')
}
