import { Router, Request, Response, NextFunction } from 'express';
import { getSession } from '../services/auth-service';
import { getBalance, earnCoins } from '../services/coin-service';
import { 
  playWheel, 
  playDice, 
  playScratchCard, 
  claimDailyBonus, 
  getGameStats, 
  getGameHistory, 
  getLeaderboard 
} from '../services/game-service';

interface SessionRequest extends Request { 
  session?: { address: string; issuedAt?: number; createdAt?: number }; 
}

const r = Router();

function requireSession(req: SessionRequest, res: Response, next: NextFunction) {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ error: 'missing session token' });
  const session = getSession(String(token));
  if (!session) return res.status(401).json({ error: 'invalid session' });
  req.session = session;
  next();
}

// Get user's game statistics
r.get('/stats', requireSession, (req: SessionRequest, res) => {
  try {
    const stats = getGameStats(req.session!.address);
    const balance = getBalance(req.session!.address);
    res.json({ ...stats, currentBalance: balance.balance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get game stats' });
  }
});

// Play wheel of fortune
r.post('/wheel', requireSession, (req: SessionRequest, res, next) => {
  try {
    const userBalance = getBalance(req.session!.address).balance;
    const result = playWheel(req.session!.address, userBalance);
    
    if (result.success) {
      // Update user balance
      const newBalance = userBalance - result.coinsSpent + result.coinsWon;
      
      // Import the internal function for balance updates (we'll need to expose this)
      // For now, use the existing earnCoins but we need a way to deduct coins too
      if (result.coinsSpent > 0) {
        // Deduct cost (we need to add a deductCoins function)
        earnCoins(req.session!.address, -result.coinsSpent, `wheel_cost_${result.gameId}`);
      }
      if (result.coinsWon > 0) {
        // Add winnings
        earnCoins(req.session!.address, result.coinsWon, `wheel_win_${result.gameId}`);
      }
      
      const updatedBalance = getBalance(req.session!.address).balance;
      res.json({ ...result, newBalance: updatedBalance });
    } else {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

// Play dice game
r.post('/dice', requireSession, (req: SessionRequest, res, next) => {
  try {
    const { prediction } = req.body;
    if (!prediction || !['high', 'low'].includes(prediction)) {
      return res.status(400).json({ error: 'prediction must be "high" or "low"' });
    }
    
    const userBalance = getBalance(req.session!.address).balance;
    const result = playDice(req.session!.address, userBalance, prediction);
    
    if (result.success) {
      // Update balance
      if (result.coinsSpent > 0) {
        earnCoins(req.session!.address, -result.coinsSpent, `dice_cost_${result.gameId}`);
      }
      if (result.coinsWon > 0) {
        earnCoins(req.session!.address, result.coinsWon, `dice_win_${result.gameId}`);
      }
      
      const updatedBalance = getBalance(req.session!.address).balance;
      res.json({ ...result, newBalance: updatedBalance });
    } else {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

// Play scratch card
r.post('/scratch', requireSession, (req: SessionRequest, res, next) => {
  try {
    const userBalance = getBalance(req.session!.address).balance;
    const result = playScratchCard(req.session!.address, userBalance);
    
    if (result.success) {
      // Update balance
      if (result.coinsSpent > 0) {
        earnCoins(req.session!.address, -result.coinsSpent, `scratch_cost_${result.gameId}`);
      }
      if (result.coinsWon > 0) {
        earnCoins(req.session!.address, result.coinsWon, `scratch_win_${result.gameId}`);
      }
      
      const updatedBalance = getBalance(req.session!.address).balance;
      res.json({ ...result, newBalance: updatedBalance });
    } else {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

// Claim daily bonus
r.post('/daily-bonus', requireSession, (req: SessionRequest, res, next) => {
  try {
    const result = claimDailyBonus(req.session!.address);
    
    if (result.success && result.coinsWon > 0) {
      earnCoins(req.session!.address, result.coinsWon, `daily_bonus_${result.gameId}`);
      const updatedBalance = getBalance(req.session!.address).balance;
      res.json({ ...result, newBalance: updatedBalance });
    } else {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

// Get game history
r.get('/history', requireSession, (req: SessionRequest, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const history = getGameHistory(req.session!.address, limit);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get game history' });
  }
});

// Get leaderboard
r.get('/leaderboard', (_req, res) => {
  try {
    const gameType = _req.query.gameType as string;
    const leaderboard = getLeaderboard(gameType);
    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get available games info
r.get('/info', (_req, res) => {
  res.json({
    games: {
      wheel: {
        name: 'Wheel of Fortune',
        description: 'Spin the wheel for big prizes!',
        cost: 5,
        maxWin: 100,
        dailyLimit: 10
      },
      dice: {
        name: 'Dice Game',
        description: 'Predict high (4-6) or low (1-3)',
        cost: 2,
        maxWin: 50,
        dailyLimit: 15
      },
      scratch: {
        name: 'Scratch Cards',
        description: 'Instant win scratch cards',
        cost: 1,
        maxWin: 25,
        dailyLimit: 20
      },
      dailyBonus: {
        name: 'Daily Bonus',
        description: 'Free daily coins',
        cost: 0,
        maxWin: 59,
        dailyLimit: 1
      }
    }
  });
});

export default r;