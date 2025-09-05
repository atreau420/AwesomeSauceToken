import { Router, Request, Response, NextFunction } from 'express';
import { getSession } from '../services/auth-service';
import { getBalance, earnCoins, purchaseCoins, redeemPremium, membershipStatus, recentCoinTransactions, getConstants } from '../services/coin-service';

interface SessionRequest extends Request { session?: { address: string; issuedAt?: number; createdAt?: number }; }

const r = Router();

function requireSession(req: SessionRequest, res: Response, next: NextFunction) {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ error: 'missing session token' });
  const session = getSession(String(token));
  if (!session) return res.status(401).json({ error: 'invalid session' });
  req.session = session;
  next();
}

r.get('/constants', (_req, res) => res.json(getConstants()));

r.get('/balance', requireSession, (req: SessionRequest, res) => {
  res.json(getBalance(req.session!.address));
});

r.post('/earn', requireSession, (req: SessionRequest, res, next) => {
  try { const { amount, ref } = req.body || {}; res.json(earnCoins(req.session!.address, Number(amount), ref)); } catch (e) { next(e); }
});

r.post('/purchase', requireSession, (req: SessionRequest, res, next) => {
  try { const { ethAmount, txHash } = req.body || {}; res.json(purchaseCoins(req.session!.address, Number(ethAmount), txHash)); } catch (e) { next(e); }
});

r.post('/redeem/premium', requireSession, (req: SessionRequest, res, next) => {
  try { res.json(redeemPremium(req.session!.address)); } catch (e) { next(e); }
});

r.get('/membership', requireSession, (req: SessionRequest, res) => {
  res.json(membershipStatus(req.session!.address));
});

r.get('/transactions', requireSession, (req: SessionRequest, res) => {
  const limit = Number(req.query.limit) || 25;
  res.json({ transactions: recentCoinTransactions(req.session!.address, limit) });
});

export default r;
