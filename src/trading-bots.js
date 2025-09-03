import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();
class AutoTradingBot {
    provider;
    wallet;
    config;
    isRunning = false;
    tradeCount = 0;
    totalProfit = 0;
    constructor(config) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    }
    async start() {
        if (this.isRunning) {
            console.log('Bot is already running');
            return;
        }
        this.isRunning = true;
        console.log('🚀 Auto Trading Bot Started');
        console.log(`📊 Monitoring ${this.config.tokenAddress}`);
        console.log(`💰 Min Trade: ${this.config.minTradeAmount} ETH`);
        console.log(`💰 Max Trade: ${this.config.maxTradeAmount} ETH`);
        console.log(`⏰ Trade Interval: ${this.config.tradeInterval} minutes`);
        console.log(`📈 Profit Threshold: ${this.config.profitThreshold}%`);
        // Start the trading loop
        this.runTradingLoop();
    }
    async stop() {
        this.isRunning = false;
        console.log('🛑 Auto Trading Bot Stopped');
        console.log(`📊 Total Trades: ${this.tradeCount}`);
        console.log(`💰 Total Profit: ${this.totalProfit} ETH`);
    }
    async runTradingLoop() {
        while (this.isRunning) {
            try {
                await this.executeTradeCycle();
                await this.sleep(this.config.tradeInterval * 60 * 1000); // Convert minutes to milliseconds
            }
            catch (error) {
                console.error('❌ Trade cycle error:', error);
                await this.sleep(30000); // Wait 30 seconds before retry
            }
        }
    }
    async executeTradeCycle() {
        const balance = await this.provider.getBalance(this.wallet.address);
        const balanceInEth = ethers.formatEther(balance);
        console.log(`💰 Current Balance: ${balanceInEth} ETH`);
        // Simple strategy: Buy low, sell high based on price movements
        const shouldBuy = await this.shouldBuy();
        const shouldSell = await this.shouldSell();
        if (shouldBuy && parseFloat(balanceInEth) > parseFloat(this.config.minTradeAmount)) {
            await this.executeBuyOrder();
        }
        else if (shouldSell) {
            await this.executeSellOrder();
        }
        else {
            console.log('⏳ Waiting for better market conditions...');
        }
    }
    async shouldBuy() {
        // Simple momentum strategy - buy if price is trending up
        try {
            const currentPrice = await this.getTokenPrice();
            const historicalPrice = await this.getHistoricalPrice(5); // 5 minutes ago
            if (currentPrice > historicalPrice * 1.002) { // 0.2% increase
                console.log('📈 Price trending up - considering buy');
                return true;
            }
        }
        catch (error) {
            console.error('Error checking buy condition:', error);
        }
        return false;
    }
    async shouldSell() {
        // Sell if we have profit above threshold
        try {
            const currentPrice = await this.getTokenPrice();
            const avgBuyPrice = await this.getAverageBuyPrice();
            if (avgBuyPrice > 0) {
                const profitPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
                if (profitPercent >= this.config.profitThreshold) {
                    console.log(`💰 Profit threshold reached: ${profitPercent.toFixed(2)}%`);
                    return true;
                }
            }
        }
        catch (error) {
            console.error('Error checking sell condition:', error);
        }
        return false;
    }
    async executeBuyOrder() {
        try {
            const amount = this.config.minTradeAmount;
            console.log(`🛒 Executing BUY order: ${amount} ETH worth of tokens`);
            // Implement Uniswap V2 swap
            const tx = await this.swapTokens(amount, this.config.baseToken, this.config.tokenAddress);
            console.log(`✅ Buy transaction: ${tx.hash}`);
            this.tradeCount++;
        }
        catch (error) {
            console.error('❌ Buy order failed:', error);
        }
    }
    async executeSellOrder() {
        try {
            // Get token balance
            const tokenContract = new ethers.Contract(this.config.tokenAddress, ['function balanceOf(address) view returns (uint256)'], this.provider);
            const tokenBalance = await tokenContract.balanceOf(this.wallet.address);
            if (tokenBalance > 0) {
                console.log(`📤 Executing SELL order: ${ethers.formatEther(tokenBalance)} tokens`);
                const tx = await this.swapTokens(ethers.formatEther(tokenBalance), this.config.tokenAddress, this.config.baseToken);
                console.log(`✅ Sell transaction: ${tx.hash}`);
                this.tradeCount++;
            }
        }
        catch (error) {
            console.error('❌ Sell order failed:', error);
        }
    }
    async swapTokens(amount, fromToken, toToken) {
        // Simplified swap implementation
        // In production, you'd use Uniswap SDK or direct router calls
        const routerAbi = [
            'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
            'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ];
        const router = new ethers.Contract(this.config.uniswapRouter, routerAbi, this.wallet);
        if (fromToken === this.config.baseToken) {
            // Buying tokens with ETH
            const path = [this.config.baseToken, this.config.tokenAddress];
            const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
            const amountOutMin = 0; // Set slippage in production
            const tx = await router.swapExactETHForTokens(amountOutMin, path, this.wallet.address, deadline, { value: ethers.parseEther(amount) });
            return tx;
        }
        else {
            // Selling tokens for ETH
            const path = [this.config.tokenAddress, this.config.baseToken];
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const amountOutMin = 0;
            const tx = await router.swapExactTokensForETH(ethers.parseEther(amount), amountOutMin, path, this.wallet.address, deadline);
            return tx;
        }
    }
    async getTokenPrice() {
        // Simplified price fetching - in production use price oracles
        try {
            // Mock price for demonstration - replace with real price feed
            return Math.random() * 0.001 + 0.0001; // Random price between 0.0001-0.0011 ETH
        }
        catch (error) {
            console.error('Error getting token price:', error);
            return 0;
        }
    }
    async getHistoricalPrice(minutesAgo) {
        // Mock historical price
        return Math.random() * 0.001 + 0.0001;
    }
    async getAverageBuyPrice() {
        // Mock average buy price - in production track actual trades
        return Math.random() * 0.001 + 0.00005;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            tradeCount: this.tradeCount,
            totalProfit: this.totalProfit
        };
    }
}
// Default configuration
const defaultConfig = {
    privateKey: process.env.PRIVATE_KEY || '',
    rpcUrl: process.env.RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    tokenAddress: process.env.TOKEN_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // Your token
    baseToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    uniswapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
    minTradeAmount: '0.001', // 0.001 ETH
    maxTradeAmount: '0.01', // 0.01 ETH
    tradeInterval: 5, // 5 minutes
    profitThreshold: 1.0 // 1% profit
};
// Global bot instance
let globalBot = null;
export async function startTradingBot() {
    if (!defaultConfig.privateKey) {
        return '❌ PRIVATE_KEY not set in environment variables';
    }
    if (globalBot && globalBot.getStatus().isRunning) {
        return '⚠️ Trading bot is already running';
    }
    try {
        globalBot = new AutoTradingBot(defaultConfig);
        await globalBot.start();
        return '✅ Trading bot started successfully! Generating passive income...';
    }
    catch (error) {
        console.error('Failed to start bot:', error);
        return `❌ Failed to start trading bot: ${error}`;
    }
}
export async function stopTradingBot() {
    if (!globalBot) {
        return '⚠️ No trading bot instance found';
    }
    try {
        await globalBot.stop();
        const status = globalBot.getStatus();
        return `🛑 Trading bot stopped. Trades: ${status.tradeCount}, Profit: ${status.totalProfit} ETH`;
    }
    catch (error) {
        return `❌ Failed to stop trading bot: ${error}`;
    }
}
export function getBotStatus() {
    if (!globalBot) {
        return '❌ No trading bot instance';
    }
    const status = globalBot.getStatus();
    return `🤖 Bot Status: ${status.isRunning ? 'Running' : 'Stopped'}
📊 Trades: ${status.tradeCount}
💰 Profit: ${status.totalProfit} ETH`;
}
// For direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    startTradingBot().then(console.log).catch(console.error);
}
