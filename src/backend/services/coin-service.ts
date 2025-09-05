// Coin / Membership service (deduplicated)
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { verifyTransaction } from './blockchain-service';

// Single database file for platform economy
const dbFile = process.env.COIN_DB_FILE || 'coin.db';
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

// Schema
db.exec(`CREATE TABLE IF NOT EXISTS user_balances (
  address TEXT PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS coin_transactions (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ref TEXT,
  createdAt TEXT NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS premium_memberships (
  address TEXT PRIMARY KEY,
  startedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS processed_transactions (
  txHash TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  ethAmount REAL NOT NULL,
  coinsAwarded INTEGER NOT NULL,
  processedAt TEXT NOT NULL,
  blockNumber INTEGER
);`);

// Economic constants
const PURCHASE_RATE = Number(process.env.COIN_PURCHASE_RATE || 1000); // coins per 1 ETH (placeholder)
const REDEEM_PREMIUM_COST = Number(process.env.COIN_PREMIUM_COST || 5000); // coins for 30‑day premium

function upsertBalance(address: string, delta: number) {
  const lower = address.toLowerCase();
  const row = db.prepare('SELECT coins FROM user_balances WHERE address=?').get(lower);
  const now = new Date().toISOString();
  if (row) {
    const newAmt = row.coins + delta;
    if (newAmt < 0) throw new Error('balance would go negative');
    db.prepare('UPDATE user_balances SET coins=?, updatedAt=? WHERE address=?').run(newAmt, now, lower);
    return newAmt;
  } else {
    if (delta < 0) throw new Error('cannot create negative balance');
    db.prepare('INSERT INTO user_balances (address, coins, updatedAt) VALUES (?,?,?)').run(lower, delta, now);
    return delta;
  }
}

function insertTx(address: string, type: string, amount: number, ref?: string) {
  const id = randomBytes(12).toString('hex');
  db.prepare('INSERT INTO coin_transactions (id,address,type,amount,ref,createdAt) VALUES (?,?,?,?,?,?)')
    .run(id, address.toLowerCase(), type, amount, ref || null, new Date().toISOString());
  return id;
}

export function getBalance(address: string) {
  const row = db.prepare('SELECT coins FROM user_balances WHERE address=?').get(address.toLowerCase());
  return { address: address.toLowerCase(), balance: row ? row.coins : 0 };
}

export function earnCoins(address: string, amount: number, ref?: string) {
  if (!Number.isFinite(amount)) throw new Error('amount required');
  if (amount === 0) throw new Error('amount cannot be zero');
  
  // Allow negative amounts for spending coins (game costs, etc.)
  if (amount > 0 && amount > 1000) throw new Error('earn amount too large (max 1000)');
  if (amount < 0 && amount < -1000) throw new Error('spend amount too large (max -1000)');
  
  const newBal = upsertBalance(address, amount);
  const txType = amount > 0 ? 'earn' : 'spend';
  insertTx(address, txType, Math.abs(amount), ref);
  return { balance: newBal, delta: amount };
}

// Expose upsertBalance for internal use by game service
export { upsertBalance };

export async function purchaseCoins(address: string, ethAmount: number, txHash?: string) {
  if (!txHash) throw new Error('transaction hash required for verification');
  
  // Check if transaction was already processed
  const existing = db.prepare('SELECT txHash FROM processed_transactions WHERE txHash = ?').get(txHash);
  if (existing) throw new Error('transaction already processed');

  // Verify transaction on-chain
  const verification = await verifyTransaction(txHash);
  if (!verification.valid) {
    throw new Error(`transaction verification failed: ${verification.error}`);
  }

  // Ensure the transaction amount matches what was claimed
  if (Math.abs(verification.ethAmount - ethAmount) > 0.0001) {
    throw new Error(`amount mismatch: claimed ${ethAmount} ETH, verified ${verification.ethAmount} ETH`);
  }

  // Convert ETH to coins using the rate
  const coins = Math.floor(verification.ethAmount * PURCHASE_RATE);
  
  // Record transaction as processed
  db.prepare('INSERT INTO processed_transactions (txHash, address, ethAmount, coinsAwarded, processedAt, blockNumber) VALUES (?,?,?,?,?,?)')
    .run(txHash, address.toLowerCase(), verification.ethAmount, coins, new Date().toISOString(), verification.blockNumber);
  
  // Credit coins to user
  const newBal = upsertBalance(address, coins);
  insertTx(address, 'purchase', coins, txHash);
  
  return { 
    coinsAdded: coins, 
    balance: newBal, 
    delta: coins, 
    verified: true,
    ethAmountVerified: verification.ethAmount,
    blockNumber: verification.blockNumber
  };
}

export function redeemPremium(address: string) {
  const bal = getBalance(address).balance;
  if (bal < REDEEM_PREMIUM_COST) throw new Error('insufficient coins');
  upsertBalance(address, -REDEEM_PREMIUM_COST);
  insertTx(address, 'redeem', REDEEM_PREMIUM_COST);
  const start = new Date();
  const expires = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  db.prepare('INSERT OR REPLACE INTO premium_memberships (address, startedAt, expiresAt) VALUES (?,?,?)')
    .run(address.toLowerCase(), start.toISOString(), expires.toISOString());
  return { premium: true, expiresAt: expires.toISOString() };
}

export function membershipStatus(address: string) {
  const row = db.prepare('SELECT startedAt, expiresAt FROM premium_memberships WHERE address=?').get(address.toLowerCase());
  if (!row) return { premium: false };
  if (Date.now() > Date.parse(row.expiresAt)) return { premium: false, expired: true };
  return { premium: true, expiresAt: row.expiresAt };
}

export function recentCoinTransactions(address: string, limit = 25) {
  return db.prepare('SELECT id,type,amount,ref,createdAt FROM coin_transactions WHERE address=? ORDER BY createdAt DESC LIMIT ?')
    .all(address.toLowerCase(), limit);
}

export function getConstants() {
  return { PURCHASE_RATE, REDEEM_PREMIUM_COST };
}

// (Optional) expose raw DB for future migrations / admin tasks (not exported by default)
