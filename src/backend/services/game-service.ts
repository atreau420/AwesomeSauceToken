// Mini-game service for rewarding users with coins
import Database from 'better-sqlite3';
import { randomBytes, createHash } from 'crypto';

// Game database
const dbFile = process.env.GAME_DB_FILE || 'games.db';
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

// Schema for game history and daily limits
db.exec(`CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  gameType TEXT NOT NULL,
  result TEXT NOT NULL,
  coinsWon INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS daily_limits (
  address TEXT NOT NULL,
  gameType TEXT NOT NULL,
  date TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  coinsWon INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (address, gameType, date)
);`);

// Game configuration
const GAME_LIMITS = {
  wheel: { dailyPlays: 10, maxCoinsPerSpin: 100, costCoins: 5 },
  dice: { dailyPlays: 15, maxCoinsPerRoll: 50, costCoins: 2 },
  lottery: { dailyPlays: 3, maxCoinsPerPlay: 1000, costCoins: 20 },
  scratch: { dailyPlays: 20, maxCoinsPerPlay: 25, costCoins: 1 }
};

interface GameResult {
  success: boolean;
  gameId: string;
  result: string;
  coinsWon: number;
  coinsSpent: number;
  remainingPlays: number;
  error?: string;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function updateDailyLimit(address: string, gameType: string): { plays: number; coinsWon: number } {
  const today = getTodayDate();
  const existing = db.prepare('SELECT plays, coinsWon FROM daily_limits WHERE address=? AND gameType=? AND date=?')
    .get(address.toLowerCase(), gameType, today);
  
  if (existing) {
    db.prepare('UPDATE daily_limits SET plays=plays+1 WHERE address=? AND gameType=? AND date=?')
      .run(address.toLowerCase(), gameType, today);
    return { plays: existing.plays + 1, coinsWon: existing.coinsWon };
  } else {
    db.prepare('INSERT INTO daily_limits (address, gameType, date, plays, coinsWon) VALUES (?,?,?,1,0)')
      .run(address.toLowerCase(), gameType, today);
    return { plays: 1, coinsWon: 0 };
  }
}

function getDailyStats(address: string, gameType: string): { plays: number; coinsWon: number } {
  const today = getTodayDate();
  const row = db.prepare('SELECT plays, coinsWon FROM daily_limits WHERE address=? AND gameType=? AND date=?')
    .get(address.toLowerCase(), gameType, today);
  return row ? { plays: row.plays, coinsWon: row.coinsWon } : { plays: 0, coinsWon: 0 };
}

function recordGameSession(address: string, gameType: string, result: string, coinsWon: number): string {
  const gameId = randomBytes(12).toString('hex');
  db.prepare('INSERT INTO game_sessions (id, address, gameType, result, coinsWon, createdAt) VALUES (?,?,?,?,?,?)')
    .run(gameId, address.toLowerCase(), gameType, result, coinsWon, new Date().toISOString());
  
  if (coinsWon > 0) {
    const today = getTodayDate();
    db.prepare('UPDATE daily_limits SET coinsWon=coinsWon+? WHERE address=? AND gameType=? AND date=?')
      .run(coinsWon, address.toLowerCase(), gameType, today);
  }
  
  return gameId;
}

export function getGameStats(address: string) {
  const stats = {};
  for (const [gameType, config] of Object.entries(GAME_LIMITS)) {
    const daily = getDailyStats(address, gameType);
    let maxWin = 0;
    if ('maxCoinsPerSpin' in config) maxWin = config.maxCoinsPerSpin;
    else if ('maxCoinsPerRoll' in config) maxWin = config.maxCoinsPerRoll;
    else if ('maxCoinsPerPlay' in config) maxWin = config.maxCoinsPerPlay;
    
    stats[gameType] = {
      playsToday: daily.plays,
      coinsWonToday: daily.coinsWon,
      remainingPlays: Math.max(0, config.dailyPlays - daily.plays),
      costPerPlay: config.costCoins,
      maxWin
    };
  }
  return stats;
}

// Wheel of Fortune Game
export function playWheel(address: string, userBalance: number): GameResult {
  const gameType = 'wheel';
  const config = GAME_LIMITS[gameType];
  const daily = getDailyStats(address, gameType);
  
  // Check daily limit
  if (daily.plays >= config.dailyPlays) {
    return {
      success: false,
      gameId: '',
      result: 'daily_limit_reached',
      coinsWon: 0,
      coinsSpent: 0,
      remainingPlays: 0,
      error: 'Daily play limit reached'
    };
  }
  
  // Check user has enough coins to play
  if (userBalance < config.costCoins) {
    return {
      success: false,
      gameId: '',
      result: 'insufficient_balance',
      coinsWon: 0,
      coinsSpent: 0,
      remainingPlays: config.dailyPlays - daily.plays,
      error: 'Insufficient coins to play'
    };
  }
  
  // Generate wheel result (weighted odds)
  const random = Math.random();
  let coinsWon = 0;
  let result = '';
  
  if (random < 0.05) { // 5% chance
    coinsWon = 100;
    result = 'jackpot';
  } else if (random < 0.15) { // 10% chance
    coinsWon = 50;
    result = 'big_win';
  } else if (random < 0.35) { // 20% chance
    coinsWon = 20;
    result = 'medium_win';
  } else if (random < 0.60) { // 25% chance  
    coinsWon = 10;
    result = 'small_win';
  } else { // 40% chance
    coinsWon = 0;
    result = 'no_win';
  }
  
  updateDailyLimit(address, gameType);
  const gameId = recordGameSession(address, gameType, result, coinsWon);
  
  return {
    success: true,
    gameId,
    result,
    coinsWon,
    coinsSpent: config.costCoins,
    remainingPlays: config.dailyPlays - daily.plays - 1
  };
}

// Dice Game
export function playDice(address: string, userBalance: number, prediction: 'high' | 'low'): GameResult {
  const gameType = 'dice';
  const config = GAME_LIMITS[gameType];
  const daily = getDailyStats(address, gameType);
  
  if (daily.plays >= config.dailyPlays) {
    return {
      success: false,
      gameId: '',
      result: 'daily_limit_reached',
      coinsWon: 0,
      coinsSpent: 0,
      remainingPlays: 0,
      error: 'Daily play limit reached'
    };
  }
  
  if (userBalance < config.costCoins) {
    return {
      success: false,
      gameId: '',
      result: 'insufficient_balance',
      coinsWon: 0,
      coinsSpent: 0,
      remainingPlays: config.dailyPlays - daily.plays,
      error: 'Insufficient coins to play'
    };
  }
  
  // Roll dice (1-6)
  const roll = Math.floor(Math.random() * 6) + 1;
  const isHigh = roll >= 4; // 4, 5, 6 are "high"
  const won = (prediction === 'high' && isHigh) || (prediction === 'low' && !isHigh);
  
  const coinsWon = won ? config.maxCoinsPerRoll : 0;
  const result = `rolled_${roll}_${won ? 'won' : 'lost'}`;
  
  updateDailyLimit(address, gameType);
  const gameId = recordGameSession(address, gameType, result, coinsWon);
  
  return {
    success: true,
    gameId,
    result,
    coinsWon,
    coinsSpent: config.costCoins,
    remainingPlays: config.dailyPlays - daily.plays - 1
  };
}

// Scratch Card Game
export function playScratchCard(address: string, userBalance: number): GameResult {
  const gameType = 'scratch';
  const config = GAME_LIMITS[gameType];
  const daily = getDailyStats(address, gameType);
  
  if (daily.plays >= config.dailyPlays) {
    return {
      success: false,
      gameId: '',
      result: 'daily_limit_reached',
      coinsWon: 0,
      coinsSpent: 0,
      remainingPlays: 0,
      error: 'Daily play limit reached'
    };
  }
  
  if (userBalance < config.costCoins) {
    return {
      success: false,
      gameId: '',
      result: 'insufficient_balance',
      coinsWon: 0,
      coinsSpent: 0,
      remainingPlays: config.dailyPlays - daily.plays,
      error: 'Insufficient coins to play'
    };
  }
  
  // Generate scratch card result (simple win/lose)
  const random = Math.random();
  let coinsWon = 0;
  let result = '';
  
  if (random < 0.3) { // 30% win rate
    coinsWon = Math.floor(Math.random() * config.maxCoinsPerPlay) + 1;
    result = `win_${coinsWon}`;
  } else {
    result = 'no_win';
  }
  
  updateDailyLimit(address, gameType);
  const gameId = recordGameSession(address, gameType, result, coinsWon);
  
  return {
    success: true,
    gameId,
    result,
    coinsWon,
    coinsSpent: config.costCoins,
    remainingPlays: config.dailyPlays - daily.plays - 1
  };
}

// Daily Challenge (free play)
export function claimDailyBonus(address: string): GameResult {
  const today = getTodayDate();
  const existing = db.prepare('SELECT id FROM game_sessions WHERE address=? AND gameType=? AND DATE(createdAt)=?')
    .get(address.toLowerCase(), 'daily_bonus', today);
  
  if (existing) {
    return {
      success: false,
      gameId: '',
      result: 'already_claimed',
      coinsWon: 0,
      coinsSpent: 0,
      remainingPlays: 0,
      error: 'Daily bonus already claimed'
    };
  }
  
  // Give random daily bonus
  const coinsWon = Math.floor(Math.random() * 50) + 10; // 10-59 coins
  const gameId = recordGameSession(address, 'daily_bonus', `bonus_${coinsWon}`, coinsWon);
  
  return {
    success: true,
    gameId,
    result: 'daily_bonus_claimed',
    coinsWon,
    coinsSpent: 0,
    remainingPlays: 0
  };
}

// Get recent game history
export function getGameHistory(address: string, limit = 20) {
  return db.prepare('SELECT id, gameType, result, coinsWon, createdAt FROM game_sessions WHERE address=? ORDER BY createdAt DESC LIMIT ?')
    .all(address.toLowerCase(), limit);
}

// Get leaderboard
export function getLeaderboard(gameType?: string): Array<{address: string, totalCoinsWon: number, gamesPlayed: number}> {
  let query = `
    SELECT address, SUM(coinsWon) as totalCoinsWon, COUNT(*) as gamesPlayed 
    FROM game_sessions 
    WHERE createdAt >= date('now', '-7 days')
  `;
  
  if (gameType) {
    query += ` AND gameType = ?`;
  }
  
  query += ` GROUP BY address ORDER BY totalCoinsWon DESC LIMIT 10`;
  
  return gameType 
    ? db.prepare(query).all(gameType)
    : db.prepare(query).all();
}