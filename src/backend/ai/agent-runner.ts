import { MaintenanceAgent } from './maintenance-agent';
import { TreasuryAgent } from './treasury-agent';
import { GameAgent } from './game-agent';
import { AgentResult } from './agent-base';
import fs from 'fs';
import { recordAgentRun } from './persistence';

const agents = [
  new MaintenanceAgent(),
  new TreasuryAgent(),
  new GameAgent()
];

let lastResults: AgentResult[] = [];

export function tickAgents() {
  Promise.all(agents.map(a => a.runIfDue())).then(results => {
    const filtered = results.filter(r => !!r) as AgentResult[];
    if (filtered.length) {
      lastResults = filtered;
      for (const r of filtered) recordAgentRun(r.agent, r.ts, r.actions, r.metrics);
      try { fs.writeFileSync('ai_agent_last_results.json', JSON.stringify({ ts: new Date().toISOString(), results: filtered }, null, 2)); } catch {}
    }
  }).catch(()=>{});
}

export function getAgentSnapshot() { return lastResults; }
