import AdvancedTradingBot from '../../advanced-trading-bot.js';
import { logger } from '../utils/logger';
import Database from 'better-sqlite3';

interface ManagedBot {
  instance: any;
  startedAt: number;
  lastPing: number;
  config: BotConfig;
  metrics: BotMetrics;
}

interface BotConfig {
  maxSlippage: number;
  minProfit: number;
  riskLevel: 'low' | 'medium' | 'high';
  tradingPairs: string[];
  autoRestart: boolean;
}

interface BotMetrics {
  tradesExecuted: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  avgProfitPerTrade: number;
  maxDrawdown: number;
  uptime: number;
  lastError?: string;
  errorCount: number;
}

const bots = new Map<string, ManagedBot>();

// Bot performance database
const dbFile = process.env.BOT_DB_FILE || 'bot.db';
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

// Schema for bot performance tracking
db.exec(`CREATE TABLE IF NOT EXISTS bot_sessions (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  endedAt TEXT,
  tradesExecuted INTEGER DEFAULT 0,
  totalProfit REAL DEFAULT 0,
  totalLoss REAL DEFAULT 0,
  errorCount INTEGER DEFAULT 0,
  lastError TEXT
);`);

db.exec(`CREATE TABLE IF NOT EXISTS bot_trades (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  address TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  amount REAL NOT NULL,
  price REAL NOT NULL,
  profit REAL,
  txHash TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY(sessionId) REFERENCES bot_sessions(id)
);`);

function createDefaultConfig(): BotConfig {
  return {
    maxSlippage: 0.5, // 0.5%
    minProfit: 0.001, // Minimum 0.1% profit
    riskLevel: 'low',
    tradingPairs: ['ETH/USDC', 'WBTC/ETH'],
    autoRestart: true
  };
}

function createDefaultMetrics(): BotMetrics {
  return {
    tradesExecuted: 0,
    totalProfit: 0,
    totalLoss: 0,
    winRate: 0,
    avgProfitPerTrade: 0,
    maxDrawdown: 0,
    uptime: 0,
    errorCount: 0
  };
}

export async function startBotFor(address: string, config?: Partial<BotConfig>) {
  try {
    if (!address) throw new Error('Address required');
    
    const botKey = address.toLowerCase();
    if (bots.has(botKey)) {
      return { alreadyRunning: true, message: 'Bot is already running for this address' };
    }

    logger.info('Starting bot for address', { address });

    // Create bot configuration
    const botConfig = { ...createDefaultConfig(), ...config };
    
    // Initialize bot instance with enhanced error handling
    const BotCtor: any = AdvancedTradingBot as any;
    const bot: any = new BotCtor({ 
      owner: address,
      ...botConfig,
      onTrade: (trade: any) => recordTrade(address, trade),
      onError: (error: any) => handleBotError(address, error)
    });

    // Create session record
    const sessionId = Date.now().toString() + Math.random().toString(36).slice(2);
    db.prepare('INSERT INTO bot_sessions (id, address, startedAt) VALUES (?, ?, ?)')
      .run(sessionId, botKey, new Date().toISOString());

    // Enhanced initialization with retry logic
    let initialized = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (typeof bot.initialize === 'function') {
          await bot.initialize();
        } else if (typeof bot.startTradingCycle === 'function') {
          bot.startTradingCycle();
        }
        initialized = true;
        break;
      } catch (error) {
        logger.warn(`Bot initialization attempt ${attempt} failed`, { address, error: error.message });
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    if (!initialized) {
      throw new Error('Failed to initialize bot after 3 attempts');
    }

    // Store managed bot
    const managedBot: ManagedBot = {
      instance: bot,
      startedAt: Date.now(),
      lastPing: Date.now(),
      config: botConfig,
      metrics: createDefaultMetrics()
    };

    // Add session ID to bot instance
    bot.sessionId = sessionId;
    bot.managedBot = managedBot;

    bots.set(botKey, managedBot);

    logger.info('Bot started successfully', { address, sessionId });
    return { 
      started: true, 
      sessionId,
      config: botConfig,
      message: 'Bot started successfully and is now trading' 
    };

  } catch (error) {
    logger.error('Failed to start bot', { address, error: error.message });
    throw new Error(`Failed to start trading bot: ${error.message}`);
  }
}

export async function stopBotFor(address: string) {
  try {
    const botKey = address.toLowerCase();
    const entry = bots.get(botKey);
    
    if (!entry) {
      return { running: false, message: 'Bot is not running' };
    }

    logger.info('Stopping bot for address', { address });

    // Graceful shutdown with timeout
    try {
      if (typeof entry.instance.shutdown === 'function') {
        const shutdownPromise = entry.instance.shutdown();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), 10000)
        );
        
        await Promise.race([shutdownPromise, timeoutPromise]);
      } else {
        entry.instance.isRunning = false;
      }
    } catch (error) {
      logger.warn('Bot shutdown had issues', { address, error: error.message });
      entry.instance.isRunning = false; // Force stop
    }

    // Update session record
    if (entry.instance.sessionId) {
      db.prepare('UPDATE bot_sessions SET endedAt = ?, tradesExecuted = ?, totalProfit = ?, totalLoss = ?, errorCount = ? WHERE id = ?')
        .run(
          new Date().toISOString(),
          entry.metrics.tradesExecuted,
          entry.metrics.totalProfit,
          entry.metrics.totalLoss,
          entry.metrics.errorCount,
          entry.instance.sessionId
        );
    }

    bots.delete(botKey);
    
    logger.info('Bot stopped successfully', { address });
    return { 
      stopped: true,
      session: {
        duration: Date.now() - entry.startedAt,
        trades: entry.metrics.tradesExecuted,
        profit: entry.metrics.totalProfit
      },
      message: 'Bot stopped successfully'
    };

  } catch (error) {
    logger.error('Failed to stop bot', { address, error: error.message });
    throw new Error(`Failed to stop trading bot: ${error.message}`);
  }
}

export async function botStatus(address: string) {
  const botKey = address.toLowerCase();
  const entry = bots.get(botKey);
  
  if (!entry) {
    return { 
      running: false, 
      message: 'Bot is not running',
      historicalData: getHistoricalBotData(address)
    };
  }

  // Update metrics from bot instance
  updateBotMetrics(entry);

  const uptime = Date.now() - entry.startedAt;
  const isHealthy = entry.lastPing > Date.now() - 60000; // Healthy if pinged within 1 minute

  return {
    running: entry.instance.isRunning && isHealthy,
    healthy: isHealthy,
    uptime,
    config: entry.config,
    metrics: {
      ...entry.metrics,
      uptime,
      avgProfitPerTrade: entry.metrics.tradesExecuted > 0 
        ? entry.metrics.totalProfit / entry.metrics.tradesExecuted 
        : 0
    },
    lastPing: entry.lastPing,
    sessionId: entry.instance.sessionId
  };
}

function updateBotMetrics(entry: ManagedBot) {
  const bot = entry.instance;
  entry.metrics.tradesExecuted = bot.tradesExecuted || 0;
  entry.metrics.totalProfit = bot.totalProfit || 0;
  entry.metrics.totalLoss = bot.totalLoss || 0;
  entry.metrics.winRate = bot.winRate || 0;
  entry.lastPing = Date.now();
  
  // Calculate additional metrics
  const netProfit = entry.metrics.totalProfit - entry.metrics.totalLoss;
  if (entry.metrics.tradesExecuted > 0) {
    entry.metrics.avgProfitPerTrade = netProfit / entry.metrics.tradesExecuted;
    entry.metrics.winRate = (entry.metrics.totalProfit / (entry.metrics.totalProfit + entry.metrics.totalLoss)) * 100;
  }
}

function recordTrade(address: string, trade: any) {
  try {
    const bot = bots.get(address.toLowerCase());
    if (!bot || !bot.instance.sessionId) return;

    const tradeId = Date.now().toString() + Math.random().toString(36).slice(2);
    db.prepare(`INSERT INTO bot_trades 
      (id, sessionId, address, pair, side, amount, price, profit, txHash, timestamp) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        tradeId,
        bot.instance.sessionId,
        address.toLowerCase(),
        trade.pair || 'unknown',
        trade.side || 'unknown',
        trade.amount || 0,
        trade.price || 0,
        trade.profit || 0,
        trade.txHash || null,
        new Date().toISOString()
      );

    logger.info('Trade recorded', { address, tradeId, profit: trade.profit });
  } catch (error) {
    logger.error('Failed to record trade', { address, error: error.message });
  }
}

function handleBotError(address: string, error: any) {
  try {
    const bot = bots.get(address.toLowerCase());
    if (!bot) return;

    bot.metrics.errorCount++;
    bot.metrics.lastError = error.message || String(error);

    logger.error('Bot error handled', { address, error: error.message });

    // Auto-restart logic for recoverable errors
    if (bot.config.autoRestart && isRecoverableError(error)) {
      logger.info('Attempting bot auto-restart', { address });
      setTimeout(() => {
        restartBot(address).catch(err => 
          logger.error('Auto-restart failed', { address, error: err.message })
        );
      }, 5000);
    }
  } catch (err) {
    logger.error('Error in error handler', { address, error: err.message });
  }
}

function isRecoverableError(error: any): boolean {
  const recoverableErrors = [
    'network timeout',
    'rate limit',
    'insufficient funds',
    'nonce too low',
    'connection refused'
  ];
  
  const errorMsg = (error.message || String(error)).toLowerCase();
  return recoverableErrors.some(recoverable => errorMsg.includes(recoverable));
}

async function restartBot(address: string) {
  const bot = bots.get(address.toLowerCase());
  if (!bot) return;

  const config = bot.config;
  await stopBotFor(address);
  await new Promise(resolve => setTimeout(resolve, 2000));
  return await startBotFor(address, config);
}

function getHistoricalBotData(address: string) {
  try {
    const sessions = db.prepare(`
      SELECT * FROM bot_sessions 
      WHERE address = ? 
      ORDER BY startedAt DESC 
      LIMIT 10
    `).all(address.toLowerCase());

    const recentTrades = db.prepare(`
      SELECT * FROM bot_trades 
      WHERE address = ? 
      ORDER BY timestamp DESC 
      LIMIT 50
    `).all(address.toLowerCase());

    return {
      recentSessions: sessions,
      recentTrades,
      totalSessions: sessions.length,
      totalTrades: recentTrades.length
    };
  } catch (error) {
    logger.error('Failed to get historical data', { address, error: error.message });
    return null;
  }
}

export function listBots() {
  return Array.from(bots.keys());
}

export function getAllBotMetrics() {
  const out: any[] = [];
  for (const [addr, data] of bots.entries()) {
    updateBotMetrics(data);
    out.push({
      address: addr,
      running: !!data.instance.isRunning,
      healthy: data.lastPing > Date.now() - 60000,
      ...data.metrics,
      startedAt: data.startedAt,
      config: data.config
    });
  }
  return out;
}

// Health check for all bots
export function performHealthCheck() {
  const now = Date.now();
  const results = {
    totalBots: bots.size,
    healthyBots: 0,
    staleBot: 0,
    totalTrades: 0,
    totalProfit: 0
  };

  for (const [address, bot] of bots.entries()) {
    updateBotMetrics(bot);
    
    if (bot.lastPing > now - 60000) {
      results.healthyBots++;
    } else {
      results.staleBot++;
      logger.warn('Stale bot detected', { address, lastPing: bot.lastPing });
    }

    results.totalTrades += bot.metrics.tradesExecuted;
    results.totalProfit += bot.metrics.totalProfit;
  }

  return results;
}

// Cleanup old sessions (run periodically)
export function cleanupOldData(daysOld = 30) {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    
    const deletedTrades = db.prepare('DELETE FROM bot_trades WHERE timestamp < ?').run(cutoffDate);
    const deletedSessions = db.prepare('DELETE FROM bot_sessions WHERE startedAt < ?').run(cutoffDate);
    
    logger.info('Cleaned up old bot data', { 
      deletedTrades: deletedTrades.changes,
      deletedSessions: deletedSessions.changes 
    });
  } catch (error) {
    logger.error('Failed to cleanup old data', { error: error.message });
  }
}
