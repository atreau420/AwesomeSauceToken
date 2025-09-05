import AdvancedTradingBot from '../../advanced-trading-bot.js';

interface ManagedBot {
  instance: any;
  startedAt: number;
}

const bots = new Map<string, ManagedBot>();

export async function startBotFor(address: string) {
  if (!address) throw new Error('Address required');
  if (bots.has(address.toLowerCase())) return { alreadyRunning: true };
  const BotCtor: any = AdvancedTradingBot as any;
  const bot: any = new BotCtor({ owner: address });
  if (typeof bot.initialize === 'function') {
    await bot.initialize();
  } else if (typeof bot.startTradingCycle === 'function') {
    bot.startTradingCycle();
  }
  bots.set(address.toLowerCase(), { instance: bot, startedAt: Date.now() });
  return { started: true };
}

export async function stopBotFor(address: string) {
  const entry = bots.get(address.toLowerCase());
  if (!entry) return { running: false };
  if (typeof entry.instance.shutdown === 'function') {
    await entry.instance.shutdown();
  } else {
    entry.instance.isRunning = false;
  }
  bots.delete(address.toLowerCase());
  return { stopped: true };
}

export async function botStatus(address: string) {
  const entry = bots.get(address.toLowerCase());
  if (!entry) return { running: false };
  return {
    running: entry.instance.isRunning,
    tradesExecuted: entry.instance.tradesExecuted,
    totalProfit: entry.instance.totalProfit,
    winRate: entry.instance.winRate
  };
}

export function listBots() {
  return Array.from(bots.keys());
}

export function getAllBotMetrics() {
  const out: any[] = [];
  for (const [addr, data] of bots.entries()) {
    const inst: any = data.instance || {};
    out.push({
      address: addr,
      running: !!inst.isRunning,
      tradesExecuted: inst.tradesExecuted || 0,
      totalProfit: inst.totalProfit || 0,
      winRate: inst.winRate || 0,
      startedAt: data.startedAt,
      roiEstimate: inst.tradesExecuted ? (inst.totalProfit / Math.max(inst.tradesExecuted,1)) : 0
    });
  }
  return out;
}
