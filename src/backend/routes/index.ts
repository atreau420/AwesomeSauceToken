import { Router } from 'express';
import wallet from './wallet';
import trading from './trading';
import metrics from './metrics';
import system from './system';
import legacy from './legacy';

const router = Router();

router.use('/wallet', wallet);
router.use('/trading', trading);
router.use('/metrics', metrics);
router.use('/system', system);
// Legacy compatibility endpoints expected by existing frontend (index.html)
router.use('/', legacy);

export default router;
