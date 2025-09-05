import { Router } from 'express';
import { getWalletBalance, connectWallet } from '../services/wallet-service';

const r = Router();

r.post('/connect', async (req, res, next) => {
  try {
    const { address } = req.body;
    const session = await connectWallet(address);
    res.json({ success: true, session });
  } catch (e) { next(e); }
});

r.get('/balance/:address', async (req, res, next) => {
  try {
    const bal = await getWalletBalance(req.params.address);
    res.json(bal);
  } catch (e) { next(e); }
});

export default r;
