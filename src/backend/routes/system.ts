import { Router } from 'express';

const startedAt = Date.now();
const r = Router();

r.get('/info', (_req, res) => {
  res.json({
    uptimeSec: (Date.now() - startedAt) / 1000,
    memory: process.memoryUsage(),
    pid: process.pid,
    node: process.version
  });
});

export default r;
