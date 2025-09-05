import { AgentBase, AgentResult } from './agent-base';
import fs from 'fs';

interface TreasuryState { balanceETH: number; targetBufferETH: number; reinvestPercent: number; lastRebalance?: string; }

const stateFile = 'ai_treasury_state.json';
function loadState(): TreasuryState {
  try { return JSON.parse(fs.readFileSync(stateFile,'utf8')); } catch { return { balanceETH: 0, targetBufferETH: 1, reinvestPercent: 70 }; }
}
function saveState(s: TreasuryState) { try { fs.writeFileSync(stateFile, JSON.stringify(s, null, 2)); } catch {} }

export class TreasuryAgent extends AgentBase {
  constructor() { super('treasury', 10 * 60 * 1000); } // every 10 min
  protected async execute(): Promise<AgentResult> {
    const st = loadState();
    const actions: string[] = [];
    // Placeholder: simulate profit accrual (would query real bot aggregate)
    const simulatedNewProfit = Math.random() * 0.01; // up to 0.01 ETH
    st.balanceETH += simulatedNewProfit;

    // Rebalance rule: keep targetBufferETH aside, rest allocate by reinvestPercent vs reserve
    if (st.balanceETH > st.targetBufferETH) {
      const excess = st.balanceETH - st.targetBufferETH;
      const reinvest = excess * (st.reinvestPercent/100);
      const reserve = excess - reinvest;
      actions.push(`allocate:reinvest ${reinvest.toFixed(5)} ETH`);
      actions.push(`allocate:reserve ${reserve.toFixed(5)} ETH`);
      st.balanceETH = st.targetBufferETH; // moved allocations out
      st.lastRebalance = new Date().toISOString();
    }

    saveState(st);
    return { agent: this.name, ts: new Date().toISOString(), actions, metrics: st };
  }
}
