export interface AgentResult {
  agent: string;
  ts: string;
  actions: string[];
  metrics?: Record<string, any>;
}

export abstract class AgentBase {
  protected lastRun: number = 0;
  constructor(public name: string, protected intervalMs: number) {}
  due(now = Date.now()) { return now - this.lastRun >= this.intervalMs; }
  async runIfDue(): Promise<AgentResult | null> {
    if (!this.due()) return null;
    this.lastRun = Date.now();
    try {
      return await this.execute();
    } catch (e: any) {
      return { agent: this.name, ts: new Date().toISOString(), actions: [`error:${e.message}`] };
    }
  }
  protected abstract execute(): Promise<AgentResult>;
}
