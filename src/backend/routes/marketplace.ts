import { Router } from 'express';
import { listActiveListings, recordPurchase, recentPurchases, stats, validateAndCompletePurchase, getPurchasesByBuyer } from '../services/marketplace-service';
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

r.get('/purchases', requireSession, (req, res) => {
  const session = (req as any).session;
  res.json({ purchases: getPurchasesByBuyer(session.address) });
});

r.post('/purchase', requireSession, async (req, res, next) => {
  try {
    const { listingId, buyer, amountEth, txHash } = req.body || {};
    const session = (req as any).session;
    
    // Ensure buyer matches authenticated user
    if (buyer?.toLowerCase() !== session.address) {
      return res.status(403).json({ error: 'Buyer address must match authenticated wallet' });
    }
    
    if (!listingId || !buyer || !amountEth || !txHash) {
      return res.status(400).json({ error: 'listingId, buyer, amountEth, and txHash are required' });
    }
    
    const result = await recordPurchase(listingId, buyer, Number(amountEth), txHash);
    
    // Immediately attempt validation
    setTimeout(async () => {
      try {
        await validateAndCompletePurchase(result.id);
      } catch (error) {
        console.error('Background validation failed:', error);
      }
    }, 2000); // Wait 2 seconds for transaction to be indexed
    
    res.json({ success: true, purchaseId: result.id, status: 'pending' });
  } catch (e) { 
    next(e); 
  }
});

r.post('/validate/:purchaseId', requireSession, async (req, res, next) => {
  try {
    const purchaseId = parseInt(req.params.purchaseId);
    if (isNaN(purchaseId)) {
      return res.status(400).json({ error: 'Invalid purchase ID' });
    }
    
    const result = await validateAndCompletePurchase(purchaseId);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default r;
