import { AgentBase, AgentResult } from './agent-base';
import fs from 'fs';

interface GameUpgradeState { lastUpgrade?: string; difficulty: number; engagementScore: number; }
const file = 'ai_game_state.json';
function load(): GameUpgradeState { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return { difficulty: 1, engagementScore: 0 }; } }
function save(s: GameUpgradeState) { try { fs.writeFileSync(file, JSON.stringify(s,null,2)); } catch {} }

export class GameAgent extends AgentBase {
  constructor() { super('game', 15 * 60 * 1000); } // every 15 min
  protected async execute(): Promise<AgentResult> {
    const s = load();
    // Simple heuristic: randomly adjust engagement & difficulty
    s.engagementScore = Math.max(0, s.engagementScore + (Math.random()*10 - 4));
    if (s.engagementScore < 20 && s.difficulty > 1) {
      s.difficulty -= 1; // ease game
    } else if (s.engagementScore > 50 && s.difficulty < 10) {
      s.difficulty += 1; // increase challenge
    }
    s.lastUpgrade = new Date().toISOString();
    save(s);
    const actions = [`set:difficulty ${s.difficulty}`, `engagement:${s.engagementScore.toFixed(2)}`];
    return { agent: this.name, ts: new Date().toISOString(), actions, metrics: s };
  }
}
