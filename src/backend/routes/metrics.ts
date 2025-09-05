import { Router } from 'express';
import { listBots } from '../services/trading-service';

const r = Router();

r.get('/bots', (_req, res) => {
  res.json({ bots: listBots() });
});

export default r;
