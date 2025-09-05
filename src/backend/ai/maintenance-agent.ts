import { AgentBase, AgentResult } from './agent-base';
import { getAllBotMetrics } from '../services/trading-service';
import fs from 'fs';

export class MaintenanceAgent extends AgentBase {
  constructor() { super('maintenance', 5 * 60 * 1000); } // every 5 min
  protected async execute(): Promise<AgentResult> {
    const metrics = getAllBotMetrics();
    const actions: string[] = [];
    // Simple heuristics: flag stalled bots (no trades in 30 min), flag negative profit
    const now = Date.now();
    for (const m of metrics) {
      if (m.running && m.tradesExecuted === 0 && (now - m.startedAt) > 30*60*1000) {
        actions.push(`alert:bot ${m.address} stalled`);
      }
      if (m.totalProfit < 0) actions.push(`warn:bot ${m.address} negative-profit`);
    }
    // Persist last snapshot (lightweight) for external analysis
    try { fs.writeFileSync('ai_maintenance_snapshot.json', JSON.stringify({ ts: new Date().toISOString(), metrics }, null, 2)); } catch {}
    return { agent: this.name, ts: new Date().toISOString(), actions, metrics: { botCount: metrics.length } };
  }
}
