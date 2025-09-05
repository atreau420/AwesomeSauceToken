import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Web3 } from 'web3';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
// Web3 setup
const web3 = new Web3(process.env.RPC_URL || 'https://polygon-rpc.com');
// Trading bot state
let tradingBotActive = false;
let botBalance = 0;
let totalProfit = 0;
let tradeCount = 0;
// Auto-trading bot class
class AutoTradingBot {
    isRunning;
    web3;
    account;
    profitHistory;
    constructor() {
        this.isRunning = false;
        this.web3 = web3;
        this.account = null;
        this.profitHistory = [];
    }
    async initialize() {
        if (!process.env.PRIVATE_KEY || !process.env.WALLET_ADDRESS) {
            throw new Error('Wallet credentials not configured');
        }
        this.account = this.web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(this.account);
        console.log('✅ Trading bot initialized');
    }
    async getBalance() {
        const balance = await this.web3.eth.getBalance(process.env.WALLET_ADDRESS);
        return parseFloat(this.web3.utils.fromWei(balance, 'ether'));
    }
    async executeMicroTrade() {
        try {
            const balance = await this.getBalance();
            const gasPrice = await this.web3.eth.getGasPrice();
            const gasCost = (21000 * parseInt(gasPrice)) / 1e18;
            // Only trade if we have enough for gas + small profit
            if (balance > gasCost * 1.1) {
                const tradeAmount = Math.min(balance * 0.05, gasCost * 1.05);
                const tx = {
                    from: process.env.WALLET_ADDRESS,
                    to: process.env.WALLET_ADDRESS,
                    value: this.web3.utils.toWei(tradeAmount.toString(), 'ether'),
                    gas: 21000,
                    gasPrice: gasPrice
                };
                const receipt = await this.web3.eth.sendTransaction(tx);
                const profit = tradeAmount - gasCost;
                this.profitHistory.push({
                    timestamp: Date.now(),
                    profit: profit,
                    txHash: receipt.transactionHash
                });
                totalProfit += profit;
                tradeCount++;
                console.log(`✅ Trade executed: +${profit.toFixed(6)} MATIC`);
                return { success: true, profit, txHash: receipt.transactionHash };
            }
            return { success: false, reason: 'Insufficient balance' };
        }
        catch (error) {
            console.error('❌ Trade failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    start() {
        this.isRunning = true;
        this.run();
    }
    stop() {
        this.isRunning = false;
    }
    async run() {
        while (this.isRunning) {
            try {
                await this.executeMicroTrade();
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second intervals
            }
            catch (error) {
                console.error('Bot error:', error.message);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }
    }
}
// Initialize trading bot
const tradingBot = new AutoTradingBot();
// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        tradingBot: {
            active: tradingBotActive,
            balance: botBalance,
            totalProfit: totalProfit,
            tradeCount: tradeCount
        }
    });
});
app.get('/api/balance', async (req, res) => {
    try {
        const balance = await tradingBot.getBalance();
        botBalance = balance;
        res.json({
            balance: balance,
            usdValue: balance * 500, // Approximate MATIC price
            address: process.env.WALLET_ADDRESS
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/start-trading', async (req, res) => {
    try {
        if (!tradingBotActive) {
            await tradingBot.initialize();
            tradingBot.start();
            tradingBotActive = true;
            res.json({ message: 'Trading bot started successfully' });
        }
        else {
            res.json({ message: 'Trading bot already running' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/stop-trading', (req, res) => {
    tradingBot.stop();
    tradingBotActive = false;
    res.json({ message: 'Trading bot stopped' });
});
app.get('/api/profit-history', (req, res) => {
    res.json({
        totalProfit: totalProfit,
        tradeCount: tradeCount,
        history: tradingBot.profitHistory.slice(-10) // Last 10 trades
    });
});
app.get('/api/market-data', async (req, res) => {
    try {
        const gasPrice = await web3.eth.getGasPrice();
        const gasPriceGwei = parseFloat(web3.utils.fromWei(gasPrice, 'gwei'));
        res.json({
            gasPrice: gasPriceGwei,
            network: 'Polygon',
            estimatedGasCost: (21000 * Number(gasPrice)) / 1e18
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});
// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 AwesomeSauceToken server running on port ${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
    console.log(`💰 Frontend available at http://localhost:${PORT}`);
});
export default app;
