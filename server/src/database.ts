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
      baseline_start DATE,
      baseline_end DATE,
      baseline_budget REAL,
      baseline_captured_at DATETIME,
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

    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      goal TEXT,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'planned',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      baseline_start DATE,
      baseline_end DATE,
      baseline_hours REAL,
      estimated_hours REAL DEFAULT 0,
      actual_hours REAL DEFAULT 0,
      completion_percent INTEGER DEFAULT 0,
      wbs_code TEXT,
      is_critical INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      sprint TEXT,
      sprint_id INTEGER REFERENCES sprints(id),
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

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      page TEXT NOT NULL,
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      conditions TEXT,
      action_type TEXT NOT NULL,
      action_config TEXT,
      enabled INTEGER DEFAULT 1,
      fire_count INTEGER DEFAULT 0,
      last_fired_at DATETIME,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      value TEXT,
      UNIQUE(field_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_time_user_date ON time_entries(user_id, date);
  `)

  runMigrations()
  seedDatabase()
}

function runMigrations() {
  const tableInfo = (table: string) => db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  const hasColumn = (table: string, col: string) => tableInfo(table).some(c => c.name === col)

  const addColumn = (table: string, col: string, type: string) => {
    if (!hasColumn(table, col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
    }
  }

  addColumn('projects', 'baseline_start', 'DATE')
  addColumn('projects', 'baseline_end', 'DATE')
  addColumn('projects', 'baseline_budget', 'REAL')
  addColumn('projects', 'baseline_captured_at', 'DATETIME')
  addColumn('tasks', 'baseline_start', 'DATE')
  addColumn('tasks', 'baseline_end', 'DATE')
  addColumn('tasks', 'baseline_hours', 'REAL')
  addColumn('tasks', 'sprint_id', 'INTEGER REFERENCES sprints(id)')
  addColumn('tasks', 'recurrence', "TEXT DEFAULT 'none'")
  addColumn('tasks', 'recurrence_until', 'DATE')
  addColumn('users', 'email_notifications', 'INTEGER DEFAULT 1')
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      secret TEXT,
      events TEXT NOT NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      enabled INTEGER DEFAULT 1,
      last_status INTEGER,
      last_fired_at DATETIME,
      fail_count INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  addColumn('webhooks', 'format', "TEXT DEFAULT 'json'") // table exists by now; upgrades It.5 DBs
  db.exec('CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON tasks(sprint_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views(user_id, page)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_automation_rules_project ON automation_rules(project_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type, enabled)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_custom_fields_project ON custom_fields(project_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_custom_field_values_task ON custom_field_values(task_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash)')
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

  // Capture baselines on active projects for EVM
  const captureBaseline = db.prepare(`
    UPDATE projects SET baseline_start = start_date, baseline_end = end_date,
      baseline_budget = budget, baseline_captured_at = CURRENT_TIMESTAMP WHERE id = ?
  `)
  const captureTaskBaseline = db.prepare(`
    UPDATE tasks SET baseline_start = start_date, baseline_end = end_date,
      baseline_hours = estimated_hours WHERE project_id = ?
  `)
  db.transaction(() => {
    for (const pid of projects) {
      captureBaseline.run(pid)
      captureTaskBaseline.run(pid)
    }
  })()

  // Sprints for Project 1 (Customer Portal), anchored to today so the demo stays live
  const addDays = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const insertSprint = db.prepare(`INSERT INTO sprints (project_id, name, goal, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)`)
  const sprint1 = insertSprint.run(projects[0], 'Sprint 1 — Foundation', 'Component library and auth flows', addDays(-42), addDays(-29), 'completed').lastInsertRowid as number
  const sprint2 = insertSprint.run(projects[0], 'Sprint 2 — Dashboard', 'Dashboard views and data wiring', addDays(-28), addDays(-15), 'completed').lastInsertRowid as number
  const sprint3 = insertSprint.run(projects[0], 'Sprint 3 — Settings & Polish', 'Profile, settings, notifications UI', addDays(-3), addDays(10), 'active').lastInsertRowid as number

  const assignSprint = db.prepare('UPDATE tasks SET sprint_id = ?, actual_end = COALESCE(?, actual_end) WHERE id = ?')
  const sprintTasks = db.transaction(() => {
    // Completed sprint 1: Component Library (13pts) + User Auth Flow (8pts)
    assignSprint.run(sprint1, addDays(-31), tasks[6])
    assignSprint.run(sprint1, addDays(-35), tasks[8])
    // Sprint 2: Dashboard Views (21pts, still in progress) + a finished API task
    assignSprint.run(sprint2, null, tasks[7])
    const apiTask = insertTask.run(projects[0], null, 'API Client Layer', 'done', 'high', users[3], addDays(-28), addDays(-18), 60, 58, 100, '3.5', 0, 10, 8).lastInsertRowid as number
    assignSprint.run(sprint2, addDays(-18), apiTask)
    // Active sprint 3
    assignSprint.run(sprint3, null, tasks[9])
    const notifTask = insertTask.run(projects[0], null, 'Notifications UI', 'in_progress', 'medium', users[4], addDays(-3), addDays(8), 40, 12, 30, '3.6', 0, 11, 5).lastInsertRowid as number
    assignSprint.run(sprint3, null, notifTask)
    const settingsApi = insertTask.run(projects[0], null, 'Settings API Wiring', 'done', 'medium', users[3], addDays(-3), addDays(-1), 24, 22, 100, '3.7', 0, 12, 3).lastInsertRowid as number
    assignSprint.run(sprint3, addDays(-1), settingsApi)
    const a11y = insertTask.run(projects[0], null, 'Empty States & A11y Pass', 'todo', 'low', users[8], addDays(2), addDays(9), 16, 0, 0, '3.8', 0, 13, 2).lastInsertRowid as number
    assignSprint.run(sprint3, null, a11y)
    // Backlog (no sprint)
    insertTask.run(projects[0], null, 'Performance Tuning', 'todo', 'medium', users[3], null, null, 40, 0, 0, '7.1', 0, 14, 8)
    insertTask.run(projects[0], null, 'Search Filters', 'todo', 'medium', users[3], null, null, 24, 0, 0, '7.2', 0, 15, 5)
    insertTask.run(projects[0], null, 'Onboarding Tour', 'todo', 'low', users[4], null, null, 16, 0, 0, '7.3', 0, 16, 3)
  })
  sprintTasks()

  // Seed sample comments on a task
  const insertComment = db.prepare(`INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)`)
  db.transaction(() => {
    insertComment.run('task', tasks[2], users[1], 'Frontend dev is progressing well, on track to complete by end of May.')
    insertComment.run('task', tasks[2], users[3], 'Just finished the dashboard widgets. Moving on to user settings panels.')
    insertComment.run('task', tasks[3], users[1], 'Payment gateway integration is the critical path here. Need to prioritize.')
    insertComment.run('task', tasks[21], users[2], 'iOS build passed app store review checks. Beta TestFlight is live.')
  })()

  // Seed notifications
  const insertNotification = db.prepare(`INSERT INTO notifications (user_id, type, title, message, link, read) VALUES (?, ?, ?, ?, ?, ?)`)
  db.transaction(() => {
    insertNotification.run(users[3], 'assignment', 'Assigned to "Profile & Settings"', 'Due in 3 weeks', `/projects/${projects[0]}/tasks`, 0)
    insertNotification.run(users[3], 'comment', 'New comment on "Frontend Development"', 'Just finished the dashboard widgets...', `/projects/${projects[0]}/tasks`, 0)
    insertNotification.run(users[1], 'risk', 'High risk identified: Third-party API instability', 'Score 6 — payment gateway outages', `/projects/${projects[0]}/risks`, 0)
    insertNotification.run(users[1], 'milestone', 'Milestone approaching: Beta Release', 'Due in 16 days', `/projects/${projects[0]}`, 1)
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

  // Custom fields for Customer Portal project
  const insertField = db.prepare(`INSERT INTO custom_fields (project_id, name, field_type, options, position) VALUES (?, ?, ?, ?, ?)`)
  const insertFieldValue = db.prepare(`INSERT INTO custom_field_values (field_id, task_id, value) VALUES (?, ?, ?)`)
  db.transaction(() => {
    const envField = insertField.run(projects[0], 'Environment', 'select', JSON.stringify(['Dev', 'Staging', 'Production']), 0).lastInsertRowid as number
    const reviewField = insertField.run(projects[0], 'Code Review Link', 'text', null, 1).lastInsertRowid as number
    insertField.run(projects[0], 'Release Date', 'date', null, 2)
    insertFieldValue.run(envField, tasks[2], 'Staging')
    insertFieldValue.run(envField, tasks[3], 'Dev')
    insertFieldValue.run(reviewField, tasks[3], 'https://github.com/acme/portal/pull/214')
  })()

  // Automation rules
  const insertRule = db.prepare(`
    INSERT INTO automation_rules (project_id, name, trigger_type, conditions, action_type, action_config, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    insertRule.run(null, 'Notify manager when any task completes', 'task_status_changed', JSON.stringify({ to_status: 'done' }), 'notify_manager', null, users[0])
    insertRule.run(null, 'Alert manager on high-severity risks', 'risk_created', JSON.stringify({ min_score: 6 }), 'notify_manager', null, users[0])
    insertRule.run(projects[0], 'Escalate critical task creation', 'task_created', JSON.stringify({ priority_in: ['critical'] }), 'notify_user', JSON.stringify({ user_id: users[1] }), users[1])
  })()

  console.log('Database seeded successfully with demo data')
}
