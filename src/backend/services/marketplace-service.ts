import Database from 'better-sqlite3';

const dbFile = process.env.MARKETPLACE_DB_FILE || 'marketplace.db';
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priceEth REAL NOT NULL,
  createdAt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);`);

db.exec(`CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listingId TEXT NOT NULL,
  buyer TEXT NOT NULL,
  txHash TEXT,
  amountEth REAL NOT NULL,
  createdAt TEXT NOT NULL
);`);

const defaultListings = [
  { id: 'bot-premium-sub', title: 'Premium Trading Bot Access', description: 'Unlock higher frequency strategies & priority AI tuning.', priceEth: 0.01 },
  { id: 'game-pass', title: 'Game Booster Pass', description: 'Enhanced rewards & engagement multiplier in on-site mini‑games.', priceEth: 0.005 },
  { id: 'analytics-pack', title: 'Advanced Analytics Pack', description: 'Access performance dashboards & real-time AI signals feed.', priceEth: 0.008 }
];

function ensureDefaults() {
  const row = db.prepare('SELECT COUNT(*) as c FROM listings').get();
  if (row.c === 0) {
    const ins = db.prepare('INSERT INTO listings (id,title,description,priceEth,createdAt,active) VALUES (@id,@title,@description,@priceEth,@createdAt,1)');
    const now = new Date().toISOString();
    for (const l of defaultListings) ins.run({ ...l, createdAt: now });
  }
}
ensureDefaults();

export function listActiveListings() {
  return db.prepare('SELECT id,title,description,priceEth,createdAt FROM listings WHERE active=1 ORDER BY rowid ASC').all();
}

export function recordPurchase(listingId: string, buyer: string, amountEth: number, txHash?: string) {
  const listing = db.prepare('SELECT id, priceEth FROM listings WHERE id=? AND active=1').get(listingId);
  if (!listing) throw new Error('Listing not found');
  const stmt = db.prepare('INSERT INTO purchases (listingId,buyer,txHash,amountEth,createdAt) VALUES (?,?,?,?,?)');
  stmt.run(listingId, buyer.toLowerCase(), txHash || null, amountEth, new Date().toISOString());
  return { listingId, buyer, amountEth, txHash };
}

export function recentPurchases(limit = 25) {
  return db.prepare('SELECT * FROM purchases ORDER BY id DESC LIMIT ?').all(limit);
}

export function stats() {
  const totals = db.prepare('SELECT COUNT(*) as purchases, COALESCE(SUM(amountEth),0) as volume FROM purchases').get();
  return totals;
}
