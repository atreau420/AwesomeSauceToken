import { Router } from 'express';
import { requestNonce, verifySignature, getSession } from '../services/auth-service';

const r = Router();

r.post('/nonce', (req, res, next) => {
  try { const { address } = req.body || {}; res.json(requestNonce(address)); } catch (e) { next(e); }
});

r.post('/verify', (req, res, next) => {
  try { const { address, signature } = req.body || {}; res.json(verifySignature(address, signature)); } catch (e) { next(e); }
});

r.get('/session', (req, res) => {
  const token = (req.headers['x-session-token'] || '') as string;
  const session = token ? getSession(token) : null;
  if (!session) return res.status(401).json({ authorized: false });
  res.json({ authorized: true, address: session.address });
});

export default r;
