import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Types
interface Transaction {
  id: string;
  type: string;
  userAddress: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  commission?: number;
  timestamp: Date;
  status: string;
}

// Global state for Vercel functions (persisted per function instance)
let userBalances = new Map<string, any>();
let transactions: Transaction[] = [];
let prizePool = { total: 10000, dailySpinPool: 1000, jackpotPool: 5000 };
let commissionRate = 0.05;
let minWithdrawal = 50;
let maxDailyWithdrawal = 1000;

// Initialize user balance
function getUserBalance(address: string) {
  if (!userBalances.has(address)) {
    userBalances.set(address, {
      fiat: 0,
      crypto: new Map([['AST', 0], ['PLANT', 0], ['ETH', 0]]),
      totalDeposited: 0,
      totalWithdrawn: 0,
      lastDeposit: null,
      lastWithdrawal: null
    });
  }
  return userBalances.get(address);
}

// Deposit endpoint
app.post('/finance/deposit', async (req: any, res: any) => {
  const { userAddress, amount, currency, paymentMethod } = req.body;

  if (!userAddress || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit request' });
  }

  try {
    const userBalance = getUserBalance(userAddress);
    const depositAmount = parseFloat(amount);
    userBalance.fiat += depositAmount;
    userBalance.totalDeposited += depositAmount;
    userBalance.lastDeposit = new Date();

    transactions.push({
      id: 'dep_' + Date.now(),
      type: 'deposit',
      userAddress,
      amount: depositAmount,
      currency,
      paymentMethod,
      timestamp: new Date(),
      status: 'completed'
    });

    res.json({
      success: true,
      newBalance: userBalance.fiat,
      transactionId: transactions[transactions.length - 1].id
    });
  } catch (error) {
    res.status(500).json({ error: 'Deposit failed' });
  }
});

// Withdrawal endpoint
app.post('/finance/withdraw', async (req: any, res: any) => {
  const { userAddress, amount, currency, paymentMethod } = req.body;

  if (!userAddress || !amount || amount < minWithdrawal) {
    return res.status(400).json({
      error: `Minimum withdrawal amount is $${minWithdrawal}`
    });
  }

  const userBalance = getUserBalance(userAddress);

  if (userBalance.fiat < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const today = new Date().toDateString();
  const todayWithdrawals = transactions
    .filter((tx: any) => tx.type === 'withdrawal' &&
             tx.userAddress === userAddress &&
             new Date(tx.timestamp).toDateString() === today)
    .reduce((sum: number, tx: any) => sum + tx.amount, 0);

  if (todayWithdrawals + amount > maxDailyWithdrawal) {
    return res.status(400).json({
      error: `Daily withdrawal limit exceeded. Max: $${maxDailyWithdrawal}`
    });
  }

  try {
    userBalance.fiat -= amount;
    userBalance.totalWithdrawn += amount;
    userBalance.lastWithdrawal = new Date();

    const commission = amount * commissionRate;
    const finalAmount = amount - commission;

    transactions.push({
      id: 'wit_' + Date.now(),
      type: 'withdrawal',
      userAddress,
      amount: finalAmount,
      commission,
      currency,
      paymentMethod,
      timestamp: new Date(),
      status: 'processing'
    });

    res.json({
      success: true,
      withdrawnAmount: finalAmount,
      commission,
      newBalance: userBalance.fiat,
      transactionId: transactions[transactions.length - 1].id,
      processingTime: '2-5 business days'
    });
  } catch (error) {
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

// Get wallet token balances
app.get('/wallet/balances/:address', async (req: any, res: any) => {
  try {
    const { address } = req.params;
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

    const ethBalance = await provider.getBalance(address);
    const balances = [{
      symbol: 'ETH',
      address: '0x0000000000000000000000000000000000000000',
      balance: parseFloat(ethers.formatEther(ethBalance)),
      decimals: 18,
      usdValue: parseFloat(ethers.formatEther(ethBalance)) * 2500
    }];

    res.json({ balances });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// Get user balance
app.get('/user/balance/:address', (req: any, res: any) => {
  const { address } = req.params;
  const balance = getUserBalance(address);
  res.json({
    address,
    fiat: balance.fiat,
    crypto: Object.fromEntries(balance.crypto),
    totalDeposited: balance.totalDeposited,
    totalWithdrawn: balance.totalWithdrawn
  });
});

// Premium subscription
app.post('/premium', (req: any, res: any) => {
  const { address } = req.body;
  // Register premium user (store in global or DB)
  if (!global.premiumUsers) global.premiumUsers = new Set();
  global.premiumUsers.add(address);
  res.json({ success: true, message: 'Premium activated for ' + address });
});

// Vercel proxy endpoint
app.get('/vercel-projects', async (req: any, res: any) => {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Vercel token not set' });
  }
  try {
    const response = await fetch('https://api.vercel.com/v1/projects', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req: any, res: any) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default app;
