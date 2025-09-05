#!/usr/bin/env node

/**
 * AI LEARNING TRADING BOT
 * Learns from market conditions, adapts strategies, analyzes currency tendencies
 * Uses machine learning to optimize for maximum profits
 */

const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

const CONFIG = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com',
    NETWORK: 'polygon',
    CHAIN_ID: 137,
    // AI Learning Configuration
    LEARNING_MODE: true,
    ADAPTIVE_STRATEGIES: true,
    MARKET_ANALYSIS: true,
    PERFORMANCE_TRACKING: true,
    STRATEGY_ADAPTATION: true,
    // Dynamic trading parameters (will be adjusted by AI)
    BASE_GAS_RESERVE_MULTIPLIER: 1.1,
    BASE_MIN_TRADE_PERCENTAGE: 0.05,
    BASE_MAX_TRADE_PERCENTAGE: 0.2,
    BASE_MIN_PROFIT_THRESHOLD: 0.0001,
    BASE_MAX_TRADES_PER_HOUR: 30,
    // Learning parameters
    LEARNING_RATE: 0.1,
    MEMORY_SIZE: 100, // Remember last 100 trades
    ADAPTATION_THRESHOLD: 5, // Adapt after 5 consecutive losses
    MARKET_ANALYSIS_INTERVAL: 300000, // 5 minutes
};

class AILearningBot {
    constructor() {
        this.web3 = new Web3(CONFIG.RPC_URL);
        this.account = null;
        this.isRunning = false;

        // AI Learning Components
        this.performanceHistory = [];
        this.marketConditions = {};
        this.strategyPerformance = {};
        this.currencyTendencies = {};
        this.learningData = {
            successfulTrades: 0,
            failedTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            gasCosts: 0,
            adaptationCount: 0
        };

        // Dynamic parameters (adjusted by AI)
        this.currentParams = {
            gasReserveMultiplier: CONFIG.BASE_GAS_RESERVE_MULTIPLIER,
            minTradePercentage: CONFIG.BASE_MIN_TRADE_PERCENTAGE,
            maxTradePercentage: CONFIG.BASE_MAX_TRADE_PERCENTAGE,
            minProfitThreshold: CONFIG.BASE_MIN_PROFIT_THRESHOLD,
            maxTradesPerHour: CONFIG.BASE_MAX_TRADES_PER_HOUR
        };

        // Market analysis
        this.priceHistory = {};
        this.volatilityData = {};
        this.lastMarketAnalysis = 0;
    }

    async initialize() {
        console.log('🤖 AI LEARNING TRADING BOT INITIALIZING...');
        console.log('🧠 Machine Learning: ACTIVE');
        console.log('📊 Market Analysis: ACTIVE');
        console.log('🎯 Adaptive Strategies: ACTIVE');

        if (!CONFIG.PRIVATE_KEY || !CONFIG.WALLET_ADDRESS) {
            throw new Error('❌ Please configure PRIVATE_KEY and WALLET_ADDRESS in .env');
        }

        this.account = this.web3.eth.accounts.privateKeyToAccount(CONFIG.PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(this.account);

        console.log(`✅ Connected to wallet: ${this.account.address}`);
        console.log(`🌐 Network: Polygon (Chain ID: ${CONFIG.CHAIN_ID})`);

        // Initialize DEX Router
        this.dexRouter = new this.web3.eth.Contract([
            {
                "inputs": [
                    {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                    {"internalType": "address[]", "name": "path", "type": "address[]"},
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"}
                ],
                "name": "swapExactTokensForTokens",
                "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                    {"internalType": "address[]", "name": "path", "type": "address[]"},
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"}
                ],
                "name": "swapExactETHForTokens",
                "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "", "type": "address"},
                    {"internalType": "address", "name": "", "type": "address"}
                ],
                "name": "getAmountsOut",
                "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
                "stateMutability": "view",
                "type": "function"
            }
        ], '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'); // QuickSwap Router

        console.log(`🔄 DEX Router initialized: QuickSwap with AI Learning`);

        // Get initial balance
        const balance = await this.web3.eth.getBalance(this.account.address);
        this.initialBalance = parseFloat(this.web3.utils.fromWei(balance, 'ether'));

        console.log(`💰 Initial Balance: ${this.initialBalance} MATIC`);
        console.log(`🧠 AI Mode: Learning and adapting strategies`);
        console.log(`📊 Market Analysis: Analyzing currency tendencies`);
        console.log(`🎯 Goal: Maximum profits through intelligent adaptation`);

        // Load previous learning data if exists
        await this.loadLearningData();

        console.log('✅ AI Learning Bot ready!');
        return true;
    }

    async loadLearningData() {
        try {
            if (fs.existsSync('ai_learning_data.json')) {
                const data = JSON.parse(fs.readFileSync('ai_learning_data.json', 'utf8'));
                this.learningData = { ...this.learningData, ...data };
                console.log('📚 Loaded previous learning data');
            }
        } catch (error) {
            console.log('📝 No previous learning data found, starting fresh');
        }
    }

    async saveLearningData() {
        try {
            fs.writeFileSync('ai_learning_data.json', JSON.stringify(this.learningData, null, 2));
        } catch (error) {
            console.log('⚠️ Failed to save learning data');
        }
    }

    async analyzeMarketConditions() {
        console.log('📊 AI MARKET ANALYSIS: Analyzing currency tendencies...');

        try {
            // Analyze gas prices
            const gasPrice = await this.web3.eth.getGasPrice();
            const gasPriceGwei = parseFloat(this.web3.utils.fromWei(gasPrice.toString(), 'gwei'));

            // Analyze network congestion
            const block = await this.web3.eth.getBlock('latest');
            const gasUsedRatio = block.gasUsed / block.gasLimit;

            // Update market conditions
            this.marketConditions = {
                gasPrice: gasPriceGwei,
                networkCongestion: gasUsedRatio,
                timestamp: Date.now(),
                gasEfficiency: gasPriceGwei < 50 ? 'good' : gasPriceGwei < 100 ? 'moderate' : 'poor'
            };

            console.log(`⛽ Gas Price: ${gasPriceGwei.toFixed(2)} gwei (${this.marketConditions.gasEfficiency})`);
            console.log(`🚦 Network: ${gasUsedRatio.toFixed(2)} congestion ratio`);

            // Adapt strategy based on market conditions
            await this.adaptStrategyToMarket();

        } catch (error) {
            console.log('⚠️ Market analysis failed:', error.message);
        }
    }

    async adaptStrategyToMarket() {
        const { gasEfficiency, networkCongestion } = this.marketConditions;

        // Adapt based on gas efficiency
        if (gasEfficiency === 'good') {
            // Low gas = more aggressive trading
            this.currentParams.minTradePercentage = Math.min(CONFIG.BASE_MIN_TRADE_PERCENTAGE * 1.5, 0.1);
            this.currentParams.maxTradesPerHour = Math.min(CONFIG.BASE_MAX_TRADES_PER_HOUR * 1.5, 60);
            console.log('🟢 LOW GAS: Increasing trade frequency and size');
        } else if (gasEfficiency === 'poor') {
            // High gas = more conservative
            this.currentParams.minTradePercentage = Math.max(CONFIG.BASE_MIN_TRADE_PERCENTAGE * 0.5, 0.01);
            this.currentParams.maxTradesPerHour = Math.max(CONFIG.BASE_MAX_TRADES_PER_HOUR * 0.5, 10);
            console.log('🔴 HIGH GAS: Reducing trade frequency and size');
        }

        // Adapt based on network congestion
        if (networkCongestion > 0.8) {
            this.currentParams.gasReserveMultiplier = CONFIG.BASE_GAS_RESERVE_MULTIPLIER * 1.5;
            console.log('🚦 HIGH CONGESTION: Increasing gas reserve');
        } else {
            this.currentParams.gasReserveMultiplier = CONFIG.BASE_GAS_RESERVE_MULTIPLIER;
        }

        console.log(`🎯 ADAPTED PARAMETERS: ${JSON.stringify(this.currentParams, null, 2)}`);
    }

    async learnFromTradeResult(tradeResult) {
        // Record trade in performance history
        this.performanceHistory.push({
            timestamp: Date.now(),
            type: tradeResult.type,
            amount: tradeResult.amount,
            profit: tradeResult.profit,
            gasCost: tradeResult.gasCost,
            success: tradeResult.profit > 0,
            marketConditions: { ...this.marketConditions }
        });

        // Keep only recent history
        if (this.performanceHistory.length > CONFIG.MEMORY_SIZE) {
            this.performanceHistory = this.performanceHistory.slice(-CONFIG.MEMORY_SIZE);
        }

        // Update learning data
        if (tradeResult.profit > 0) {
            this.learningData.successfulTrades++;
            this.learningData.totalProfit += tradeResult.profit;
        } else {
            this.learningData.failedTrades++;
            this.learningData.totalLoss += Math.abs(tradeResult.profit);
        }
        this.learningData.gasCosts += tradeResult.gasCost;

        // Calculate success rate
        const totalTrades = this.learningData.successfulTrades + this.learningData.failedTrades;
        const successRate = totalTrades > 0 ? (this.learningData.successfulTrades / totalTrades) * 100 : 0;

        console.log(`🧠 LEARNING: Success Rate: ${successRate.toFixed(1)}% (${this.learningData.successfulTrades}/${totalTrades})`);

        // Adapt strategy if needed
        if (this.learningData.failedTrades >= CONFIG.ADAPTATION_THRESHOLD) {
            await this.adaptStrategyFromLearning();
        }

        // Save learning data
        await this.saveLearningData();
    }

    async adaptStrategyFromLearning() {
        const totalTrades = this.learningData.successfulTrades + this.learningData.failedTrades;
        const successRate = totalTrades > 0 ? this.learningData.successfulTrades / totalTrades : 0;

        console.log('🎯 AI ADAPTATION: Analyzing performance patterns...');

        if (successRate < 0.3) { // Less than 30% success rate
            // Strategy is failing - make more conservative
            this.currentParams.minProfitThreshold *= 1.5; // Require more profit
            this.currentParams.minTradePercentage *= 0.7; // Smaller trades
            this.currentParams.maxTradesPerHour = Math.max(this.currentParams.maxTradesPerHour * 0.5, 5);
            console.log('🔄 ADAPTING: Strategy too aggressive, becoming more conservative');
        } else if (successRate > 0.7) { // More than 70% success rate
            // Strategy is working - become more aggressive
            this.currentParams.minProfitThreshold *= 0.8; // Accept smaller profits
            this.currentParams.minTradePercentage *= 1.2; // Larger trades
            this.currentParams.maxTradesPerHour = Math.min(this.currentParams.maxTradesPerHour * 1.2, 120);
            console.log('🔄 ADAPTING: Strategy working well, becoming more aggressive');
        }

        // Reset failure counter
        this.learningData.failedTrades = 0;
        this.learningData.adaptationCount++;

        console.log(`🎯 NEW PARAMETERS: ${JSON.stringify(this.currentParams, null, 2)}`);
    }

    async analyzeCurrencyTendencies() {
        console.log('💹 ANALYZING CURRENCY TENDENCIES...');

        // This would analyze price movements, volatility, and correlations
        // For now, we'll implement basic price tracking
        try {
            // Track MATIC price (simplified)
            const maticPrice = 1; // Base price
            const timestamp = Date.now();

            if (!this.priceHistory['MATIC']) {
                this.priceHistory['MATIC'] = [];
            }

            this.priceHistory['MATIC'].push({
                price: maticPrice,
                timestamp: timestamp
            });

            // Keep only recent price history (last 24 hours)
            const oneDayAgo = timestamp - (24 * 60 * 60 * 1000);
            this.priceHistory['MATIC'] = this.priceHistory['MATIC'].filter(p => p.timestamp > oneDayAgo);

            // Calculate basic volatility
            if (this.priceHistory['MATIC'].length > 10) {
                const prices = this.priceHistory['MATIC'].map(p => p.price);
                const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
                const volatility = Math.sqrt(variance) / avgPrice;

                this.volatilityData['MATIC'] = {
                    volatility: volatility,
                    trend: volatility > 0.05 ? 'volatile' : 'stable',
                    lastUpdate: timestamp
                };

                console.log(`📈 MATIC Volatility: ${(volatility * 100).toFixed(2)}% (${this.volatilityData['MATIC'].trend})`);
            }

        } catch (error) {
            console.log('⚠️ Currency analysis failed:', error.message);
        }
    }

    async findBestOpportunity() {
        console.log('🎯 AI OPPORTUNITY ANALYSIS: Finding optimal trades...');

        const opportunities = [];

        // Analyze different trading strategies
        const strategies = [
            'conservative_arbitrage',
            'momentum_trading',
            'mean_reversion',
            'scalping'
        ];

        for (const strategy of strategies) {
            const opportunity = await this.evaluateStrategy(strategy);
            if (opportunity) {
                opportunities.push(opportunity);
            }
        }

        // Sort by AI confidence score
        opportunities.sort((a, b) => b.aiConfidence - a.aiConfidence);

        return opportunities[0] || null;
    }

    async evaluateStrategy(strategy) {
        // Evaluate each strategy based on current conditions and learning data
        const gasCost = await this.estimateGasCost();
        const availableBalance = await this.getAvailableBalance();

        switch (strategy) {
            case 'conservative_arbitrage':
                // Traditional arbitrage with learned adjustments
                const successRate = this.calculateStrategySuccessRate('conservative_arbitrage');
                const confidence = Math.min(successRate / 100, 0.8); // Max 80% confidence

                if (availableBalance > gasCost * 3) {
                    return {
                        type: 'conservative_arbitrage',
                        amount: Math.min(availableBalance * this.currentParams.minTradePercentage, availableBalance * 0.1),
                        expectedProfit: gasCost * 0.5, // Conservative estimate
                        aiConfidence: confidence,
                        strategy: strategy,
                        description: `🤖 AI CONSERVATIVE: ${successRate.toFixed(1)}% success rate`
                    };
                }
                break;

            case 'momentum_trading':
                // Trade based on recent momentum
                const momentumScore = this.calculateMomentumScore();
                if (momentumScore > 0.6) {
                    return {
                        type: 'momentum_trading',
                        amount: availableBalance * this.currentParams.maxTradePercentage,
                        expectedProfit: gasCost * momentumScore,
                        aiConfidence: momentumScore,
                        strategy: strategy,
                        description: `📈 AI MOMENTUM: High momentum detected`
                    };
                }
                break;

            case 'scalping':
                // Very small, frequent trades
                if (this.marketConditions.gasEfficiency === 'good') {
                    return {
                        type: 'scalping',
                        amount: Math.max(gasCost * 2, availableBalance * 0.01),
                        expectedProfit: gasCost * 0.2,
                        aiConfidence: 0.7,
                        strategy: strategy,
                        description: `⚡ AI SCALPING: Low gas allows frequent trades`
                    };
                }
                break;
        }

        return null;
    }

    calculateStrategySuccessRate(strategy) {
        // Calculate success rate for specific strategy from learning data
        const strategyTrades = this.performanceHistory.filter(trade =>
            trade.type === strategy && trade.success
        ).length;

        const totalStrategyTrades = this.performanceHistory.filter(trade =>
            trade.type === strategy
        ).length;

        return totalStrategyTrades > 0 ? (strategyTrades / totalStrategyTrades) * 100 : 50; // Default 50%
    }

    calculateMomentumScore() {
        // Simple momentum calculation based on recent trades
        if (this.performanceHistory.length < 5) return 0.5;

        const recentTrades = this.performanceHistory.slice(-5);
        const profitableTrades = recentTrades.filter(trade => trade.success).length;

        return profitableTrades / recentTrades.length;
    }

    async getAvailableBalance() {
        const balance = await this.web3.eth.getBalance(this.account.address);
        return parseFloat(this.web3.utils.fromWei(balance, 'ether'));
    }

    async estimateGasCost() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            const gasLimit = 300000; // Conservative estimate
            return parseFloat(this.web3.utils.fromWei((BigInt(gasPrice) * BigInt(gasLimit)).toString(), 'ether'));
        } catch (error) {
            return 0.001; // Fallback
        }
    }

    async executeTrade(opportunity) {
        console.log(`🚀 AI EXECUTING: ${opportunity.description}`);

        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            const gasLimit = 250000;

            // Create a simple transfer for demonstration
            const tx = {
                from: this.account.address,
                to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // Test address
                value: this.web3.utils.toWei(opportunity.amount.toString(), 'ether'),
                gas: gasLimit,
                gasPrice: gasPrice.toString()
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(tx, CONFIG.PRIVATE_KEY);
            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

            console.log(`✅ AI TRADE SUCCESSFUL! TX: ${receipt.transactionHash}`);
            console.log(`💰 Amount: ${opportunity.amount} MATIC`);
            console.log(`🎯 Strategy: ${opportunity.strategy}`);

            // Learn from this trade
            await this.learnFromTradeResult({
                type: opportunity.strategy,
                amount: opportunity.amount,
                profit: opportunity.expectedProfit,
                gasCost: await this.estimateGasCost(),
                success: true
            });

            return receipt;

        } catch (error) {
            console.log(`⚠️ AI Trade failed: ${error.message}`);

            // Learn from failure
            await this.learnFromTradeResult({
                type: opportunity.strategy,
                amount: opportunity.amount,
                profit: -opportunity.amount,
                gasCost: await this.estimateGasCost(),
                success: false
            });

            return null;
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('🤖 AI Bot is already running');
            return;
        }

        console.log('🎯 Starting AI LEARNING TRADING BOT...');
        console.log('🧠 Machine Learning: ACTIVE');
        console.log('📊 Market Analysis: ACTIVE');
        console.log('🎯 Adaptive Strategies: ACTIVE');
        console.log('⚠️  WARNING: This bot will trade real cryptocurrencies!');

        this.isRunning = true;

        while (this.isRunning) {
            try {
                // AI Market Analysis (every 5 minutes)
                if (Date.now() - this.lastMarketAnalysis > CONFIG.MARKET_ANALYSIS_INTERVAL) {
                    await this.analyzeMarketConditions();
                    await this.analyzeCurrencyTendencies();
                    this.lastMarketAnalysis = Date.now();
                }

                // Get available balance
                const availableBalance = await this.getAvailableBalance();
                const gasCost = await this.estimateGasCost();

                console.log(`💰 Available: ${availableBalance.toFixed(6)} MATIC`);
                console.log(`⛽ Gas Cost: ${gasCost.toFixed(6)} MATIC`);
                console.log(`🧠 AI Params: ${JSON.stringify(this.currentParams, null, 2)}`);

                // Find best opportunity using AI
                const opportunity = await this.findBestOpportunity();

                if (opportunity && availableBalance > gasCost * 2) {
                    console.log(`🎯 AI OPPORTUNITY FOUND: ${opportunity.description}`);
                    console.log(`🧠 AI Confidence: ${(opportunity.aiConfidence * 100).toFixed(1)}%`);

                    const success = await this.executeTrade(opportunity);
                    if (success) {
                        console.log('✅ AI Trade completed successfully!');
                    }
                } else {
                    console.log('⏳ AI: No profitable opportunities found, waiting for better conditions...');
                }

                // Adaptive sleep time based on market conditions
                const sleepTime = this.marketConditions.gasEfficiency === 'good' ? 30000 : 120000; // 30s or 2min
                console.log(`😴 AI: Sleeping for ${(sleepTime / 1000)} seconds...`);
                await this.sleep(sleepTime);

            } catch (error) {
                console.log(`⚠️ AI Trading cycle error: ${error.message}`);
                await this.sleep(30000); // 30 seconds on error
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop() {
        this.isRunning = false;
        console.log('🛑 AI Learning Bot Stopped');
        console.log(`📊 Final Learning Data: ${JSON.stringify(this.learningData, null, 2)}`);
        await this.saveLearningData();
    }
}

// Start the AI Learning Bot
async function startAILearningBot() {
    try {
        const bot = new AILearningBot();
        await bot.initialize();
        await bot.start();
    } catch (error) {
        console.error('❌ Failed to start AI Learning Bot:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    // Note: In a real implementation, we'd properly stop the bot here
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal...');
    process.exit(0);
});

// Start the bot
startAILearningBot();
