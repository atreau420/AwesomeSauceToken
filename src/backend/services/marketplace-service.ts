import Database from 'better-sqlite3';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';

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
  createdAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  validatedAt TEXT,
  escrowStatus TEXT DEFAULT 'none'
);`);

// Add missing columns to existing database
try {
  db.exec(`ALTER TABLE purchases ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';`);
} catch (e) {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE purchases ADD COLUMN validatedAt TEXT;`);
} catch (e) {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE purchases ADD COLUMN escrowStatus TEXT DEFAULT 'none';`);
} catch (e) {
  // Column already exists
}

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

// Get treasury address from environment
const TREASURY_ADDRESS = (process.env.MARKETPLACE_TREASURY || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e').toLowerCase();

// Get provider for transaction validation
const getProvider = () => {
  const rpcUrl = process.env.ETH_RPC_URL || process.env.BASE_RPC_URL || 'https://base.llamarpc.com';
  return new ethers.JsonRpcProvider(rpcUrl);
};

export async function validateTransaction(txHash: string, expectedBuyer: string, expectedAmount: number): Promise<{ valid: boolean; error?: string }> {
  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (receipt.status !== 1) {
      return { valid: false, error: 'Transaction failed' };
    }

    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: 'Transaction details not found' };
    }

    // Validate recipient (treasury)
    if (tx.to?.toLowerCase() !== TREASURY_ADDRESS) {
      return { valid: false, error: 'Invalid recipient address' };
    }

    // Validate sender
    if (tx.from.toLowerCase() !== expectedBuyer.toLowerCase()) {
      return { valid: false, error: 'Transaction sender mismatch' };
    }

    // Validate amount (allow small variance for gas precision)
    const actualAmountEth = parseFloat(ethers.formatEther(tx.value));
    const tolerance = 0.0001; // 0.01% tolerance
    if (Math.abs(actualAmountEth - expectedAmount) > tolerance) {
      return { valid: false, error: `Amount mismatch: expected ${expectedAmount}, got ${actualAmountEth}` };
    }

    // Check block confirmations (require at least 1 confirmation)
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - (receipt.blockNumber || 0);
    if (confirmations < 1) {
      return { valid: false, error: 'Insufficient confirmations' };
    }

    return { valid: true };
  } catch (error) {
    logger.error('Transaction validation error:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

export function listActiveListings() {
  return db.prepare('SELECT id,title,description,priceEth,createdAt FROM listings WHERE active=1 ORDER BY rowid ASC').all();
}

export async function recordPurchase(listingId: string, buyer: string, amountEth: number, txHash?: string) {
  const listing = db.prepare('SELECT id, priceEth FROM listings WHERE id=? AND active=1').get(listingId);
  if (!listing) throw new Error('Listing not found');

  // Validate exact price match
  if (Math.abs(amountEth - listing.priceEth) > 0.0001) {
    throw new Error('Payment amount does not match listing price');
  }

  const purchaseId = db.prepare('INSERT INTO purchases (listingId,buyer,txHash,amountEth,createdAt,status) VALUES (?,?,?,?,?,?) RETURNING id')
    .get(listingId, buyer.toLowerCase(), txHash || null, amountEth, new Date().toISOString(), 'pending').id;

  return { id: purchaseId, listingId, buyer, amountEth, txHash, status: 'pending' };
}

export async function validateAndCompletePurchase(purchaseId: number): Promise<{ success: boolean; error?: string }> {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id=? AND status=?').get(purchaseId, 'pending');
  if (!purchase) {
    return { success: false, error: 'Purchase not found or already processed' };
  }

  if (!purchase.txHash) {
    return { success: false, error: 'No transaction hash provided' };
  }

  try {
    const validation = await validateTransaction(purchase.txHash, purchase.buyer, purchase.amountEth);
    
    if (!validation.valid) {
      // Mark as failed
      db.prepare('UPDATE purchases SET status=?, validatedAt=? WHERE id=?')
        .run('failed', new Date().toISOString(), purchaseId);
      return { success: false, error: validation.error };
    }

    // Mark as completed
    db.prepare('UPDATE purchases SET status=?, validatedAt=?, escrowStatus=? WHERE id=?')
      .run('completed', new Date().toISOString(), 'released', purchaseId);

    logger.info(`Purchase ${purchaseId} validated and completed`, { 
      listingId: purchase.listingId, 
      buyer: purchase.buyer, 
      txHash: purchase.txHash 
    });

    return { success: true };
  } catch (error) {
    logger.error(`Purchase validation failed for ${purchaseId}:`, error);
    return { success: false, error: 'Validation error occurred' };
  }
}

export function recentPurchases(limit = 25) {
  return db.prepare('SELECT * FROM purchases ORDER BY id DESC LIMIT ?').all(limit);
}

export function getPurchasesByBuyer(buyer: string, limit = 10) {
  return db.prepare('SELECT * FROM purchases WHERE buyer=? ORDER BY id DESC LIMIT ?').all(buyer.toLowerCase(), limit);
}

export function getPendingPurchases() {
  return db.prepare('SELECT * FROM purchases WHERE status=? ORDER BY createdAt ASC').all('pending');
}

export function stats() {
  try {
    const totals = db.prepare('SELECT COUNT(*) as purchases, COALESCE(SUM(amountEth),0) as volume FROM purchases WHERE status=?').get('completed');
    const pending = db.prepare('SELECT COUNT(*) as count FROM purchases WHERE status=?').get('pending');
    return { ...totals, pendingPurchases: pending.count };
  } catch (error) {
    // Fallback for databases without status column
    const totals = db.prepare('SELECT COUNT(*) as purchases, COALESCE(SUM(amountEth),0) as volume FROM purchases').get();
    return { ...totals, pendingPurchases: 0 };
  }
}
