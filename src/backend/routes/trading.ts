import { Router } from 'express';
import { startBotFor, stopBotFor, botStatus } from '../services/trading-service';

const r = Router();

r.post('/start', async (req, res, next) => {
  try {
    const { address } = req.body;
    const result = await startBotFor(address);
    res.json({ success: true, result });
  } catch (e) { next(e); }
});

r.post('/stop', async (req, res, next) => {
  try {
    const { address } = req.body;
    const result = await stopBotFor(address);
    res.json({ success: true, result });
  } catch (e) { next(e); }
});

r.get('/status/:address', async (req, res, next) => {
  try {
    res.json(await botStatus(req.params.address));
  } catch (e) { next(e); }
});

export default r;
