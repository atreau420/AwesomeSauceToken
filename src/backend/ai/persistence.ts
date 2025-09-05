import Database from 'better-sqlite3';
import fs from 'fs';

const dbFile = process.env.AI_DB_FILE || 'ai_system.db';
const db = new Database(dbFile);

db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  ts TEXT NOT NULL,
  actions TEXT NOT NULL,
  metrics TEXT
);`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_ts ON agent_runs(agent, ts);`);

export function recordAgentRun(agent: string, ts: string, actions: string[], metrics?: any) {
  const stmt = db.prepare('INSERT INTO agent_runs (agent, ts, actions, metrics) VALUES (?, ?, ?, ?)');
  stmt.run(agent, ts, JSON.stringify(actions), metrics ? JSON.stringify(metrics) : null);
}

export function recentAgentRuns(limit = 50) {
  return db.prepare('SELECT * FROM agent_runs ORDER BY id DESC LIMIT ?').all(limit).map(r => ({
    ...r,
    actions: JSON.parse(r.actions || '[]'),
    metrics: r.metrics ? JSON.parse(r.metrics) : undefined
  }));
}

export function closeDb() { db.close(); }
