import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { startTradingBot, stopTradingBot, getBotStatus } from '../src/trading-bots.js';
// Load environment variables
dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());
// Initialize Trading Bot
const botConfig = {
    privateKey: process.env.PRIVATE_KEY || '',
    rpcUrl: process.env.RPC_URL || 'https://cloudflare-eth.com',
    tokenAddress: process.env.TOKEN_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    baseToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    uniswapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    minTradeAmount: process.env.MIN_TRADE_AMOUNT || '0.001',
    maxTradeAmount: process.env.MAX_TRADE_AMOUNT || '0.01',
    tradeInterval: parseInt(process.env.TRADE_INTERVAL || '5'),
    profitThreshold: parseFloat(process.env.PROFIT_THRESHOLD || '1.0')
};
// Global state for Vercel functions (persisted per function instance)
let userBalances = new Map();
let transactions = [];
let prizePool = { total: 10000, dailySpinPool: 1000, jackpotPool: 5000 };
let commissionRate = 0.05;
let minWithdrawal = 50;
let maxDailyWithdrawal = 1000;
// Initialize user balance
function getUserBalance(address) {
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
app.post('/finance/deposit', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Deposit failed' });
    }
});
// Withdrawal endpoint
app.post('/finance/withdraw', async (req, res) => {
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
        .filter((tx) => tx.type === 'withdrawal' &&
        tx.userAddress === userAddress &&
        new Date(tx.timestamp).toDateString() === today)
        .reduce((sum, tx) => sum + tx.amount, 0);
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
    }
    catch (error) {
        res.status(500).json({ error: 'Withdrawal failed' });
    }
});
// Get wallet token balances
app.get('/wallet/balances/:address', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch balances' });
    }
});
// Get user balance
app.get('/user/balance/:address', (req, res) => {
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
app.post('/premium', (req, res) => {
    const { address, currency = 'ETH' } = req.body;
    // Register premium user (store in global or DB)
    if (!global.premiumUsers)
        global.premiumUsers = new Map();
    global.premiumUsers.set(address, { currency, timestamp: new Date() });
    res.json({ success: true, message: 'Premium activated for ' + address + ' with ' + currency });
});
// Vercel proxy endpoint
app.get('/vercel-projects', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Bot Control Endpoints
app.post('/bot/start', async (req, res) => {
    try {
        const result = await startTradingBot();
        res.status(200).send(result);
    }
    catch (error) {
        res.status(500).send(`❌ Failed to start bot: ${error.message}`);
    }
});
app.post('/bot/stop', async (req, res) => {
    try {
        const result = await stopTradingBot();
        res.status(200).send(result);
    }
    catch (error) {
        res.status(500).send(`❌ Failed to stop bot: ${error.message}`);
    }
});
app.get('/bot/status', async (req, res) => {
    try {
        const result = getBotStatus();
        res.status(200).send(result);
    }
    catch (error) {
        res.status(500).send(`❌ Failed to get bot status: ${error.message}`);
    }
});
export default app;
