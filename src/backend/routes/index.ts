import { Router } from 'express';
import wallet from './wallet';
import trading from './trading';
import metrics from './metrics';
import system from './system';
import marketplace from './marketplace';
import auth from './auth';
import legacy from './legacy';
import coin from './coin';
import games from './games';

const router = Router();

router.use('/wallet', wallet);
router.use('/trading', trading);
router.use('/metrics', metrics);
router.use('/system', system);
router.use('/auth', auth);
router.use('/marketplace', marketplace);
router.use('/coin', coin);
router.use('/games', games);
// Legacy compatibility endpoints expected by existing frontend (index.html)
router.use('/', legacy);

export default router;
