import { Router } from 'express';
import { startBotFor, stopBotFor, botStatus } from '../services/trading-service';

// Legacy routes to satisfy existing frontend calls in public/index.html
// These mirror older endpoints: /api/bot/start, /api/bot/stop, /api/bot/status, /api/health, /api/premium

const r = Router();

// Start bot (no address provided in legacy UI, use placeholder or single tenant mode)
r.post('/bot/start', async (_req, res, next) => {
  try {
    // Single-tenant fallback address (could be replaced by user session)
    const address = process.env.WALLET_ADDRESS || '0xlegacy00000000000000000000000000000000';
    const result = await startBotFor(address);
    res.type('text/plain').send(result.alreadyRunning ? '🤖 Bot already running' : '✅ Bot started');
  } catch (e) { next(e); }
});

r.post('/bot/stop', async (_req, res, next) => {
  try {
    const address = process.env.WALLET_ADDRESS || '0xlegacy00000000000000000000000000000000';
    const result = await stopBotFor(address);
    res.type('text/plain').send(result.stopped ? '🛑 Bot stopped' : 'ℹ️ Bot was not running');
  } catch (e) { next(e); }
});

r.get('/bot/status', async (_req, res, next) => {
  try {
    const address = process.env.WALLET_ADDRESS || '0xlegacy00000000000000000000000000000000';
    const status = await botStatus(address);
    const txt = status.running
      ? `🤖 Status: Running | Trades: ${status.metrics?.tradesExecuted || 0} | Profit: ${(status.metrics?.totalProfit || 0).toFixed?.(4) || 0} ETH | WinRate: ${status.metrics?.winRate || 0}%`
      : '🛑 Bot Stopped';
    res.type('text/plain').send(txt);
  } catch (e) { next(e); }
});

r.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Premium endpoint placeholder (records subscription attempts)
const premiumUsers: Set<string> = new Set();

r.post('/premium', (req, res) => {
  const { address, currency } = req.body || {};
  if (address) premiumUsers.add(address.toLowerCase());
  res.json({ recorded: !!address, currency });
});

r.get('/premium/:address', (req, res) => {
  const a = req.params.address.toLowerCase();
  res.json({ premium: premiumUsers.has(a) });
});

export default r;
