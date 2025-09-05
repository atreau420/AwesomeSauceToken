// Coin / Membership service (deduplicated)
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

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
  if (amount <= 0 || amount > 1000) throw new Error('invalid amount');
  const newBal = upsertBalance(address, amount);
  insertTx(address, 'earn', amount, ref);
  return { balance: newBal, delta: amount };
}

export function purchaseCoins(address: string, ethAmount: number, txHash?: string) {
  if (!Number.isFinite(ethAmount) || ethAmount <= 0) throw new Error('ethAmount required');
  // Placeholder conversion; TODO: verify on-chain receipt then credit coins
  const coins = Math.floor(ethAmount * PURCHASE_RATE);
  const newBal = upsertBalance(address, coins);
  insertTx(address, 'purchase', coins, txHash);
  return { coinsAdded: coins, balance: newBal, delta: coins };
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
