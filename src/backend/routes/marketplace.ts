import { Router } from 'express';
import { listActiveListings, recordPurchase, recentPurchases, stats } from '../services/marketplace-service';
import { getSession } from '../services/auth-service';

const r = Router();

// Auth middleware (wallet signature based)
function requireSession(req: any, res: any, next: any) {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ error: 'missing session token' });
  const session = getSession(String(token));
  if (!session) return res.status(401).json({ error: 'invalid session' });
  (req as any).session = session;
  next();
}

r.get('/listings', (_req, res) => {
  res.json({ listings: listActiveListings() });
});

r.get('/stats', (_req, res) => {
  res.json(stats());
});

r.get('/purchases', requireSession, (_req, res) => {
  res.json({ purchases: recentPurchases() });
});

r.post('/purchase', requireSession, (req, res, next) => {
  try {
    const { listingId, buyer, amountEth, txHash } = req.body || {};
    if (!listingId || !buyer || !amountEth) throw new Error('listingId, buyer, amountEth required');
    const result = recordPurchase(listingId, buyer, Number(amountEth), txHash);
    res.json({ success: true, result });
  } catch (e) { next(e); }
});

export default r;
