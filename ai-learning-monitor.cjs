#!/usr/bin/env node

/**
 * AI LEARNING BOT MONITOR
 * Real-time performance monitoring and analytics for the AI Learning Trading Bot
 */

const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

class AILearningMonitor {
    constructor() {
        this.web3 = new Web3(process.env.RPC_URL || 'https://polygon-rpc.com');
        this.account = null;
        this.isRunning = false;
        this.startTime = Date.now();
        this.lastBalance = 0;
        this.performanceData = {
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            totalGasCosts: 0,
            currentBalance: 0,
            initialBalance: 0,
            netProfit: 0,
            profitPercentage: 0,
            winRate: 0,
            averageProfit: 0,
            averageLoss: 0,
            largestWin: 0,
            largestLoss: 0,
            tradesPerHour: 0,
            gasEfficiency: 0
        };
    }

    async initialize() {
        console.log('📊 AI LEARNING BOT MONITOR INITIALIZING...');

        if (!process.env.WALLET_ADDRESS) {
            throw new Error('❌ Please configure WALLET_ADDRESS in .env');
        }

        this.account = { address: process.env.WALLET_ADDRESS };

        // Get initial balance
        const balance = await this.web3.eth.getBalance(this.account.address);
        this.performanceData.initialBalance = parseFloat(this.web3.utils.fromWei(balance, 'ether'));
        this.lastBalance = this.performanceData.initialBalance;

        console.log(`✅ Monitoring wallet: ${this.account.address}`);
        console.log(`💰 Initial Balance: ${this.performanceData.initialBalance} MATIC`);
        console.log(`📊 Real-time monitoring: ACTIVE`);

        return true;
    }

    async start() {
        if (this.isRunning) {
            console.log('📊 Monitor is already running');
            return;
        }

        console.log('📊 Starting AI Learning Bot Monitor...');
        this.isRunning = true;

        while (this.isRunning) {
            try {
                await this.updatePerformanceData();
                await this.displayPerformanceReport();
                await this.analyzeTrends();

                await this.sleep(10000); // Update every 10 seconds

            } catch (error) {
                console.log(`⚠️ Monitor error: ${error.message}`);
                await this.sleep(5000);
            }
        }
    }

    async updatePerformanceData() {
        try {
            // Get current balance
            const balance = await this.web3.eth.getBalance(this.account.address);
            this.performanceData.currentBalance = parseFloat(this.web3.utils.fromWei(balance, 'ether'));

            // Calculate net profit
            this.performanceData.netProfit = this.performanceData.currentBalance - this.performanceData.initialBalance;
            this.performanceData.profitPercentage = (this.performanceData.netProfit / this.performanceData.initialBalance) * 100;

            // Load learning data from AI bot
            if (fs.existsSync('ai_learning_data.json')) {
                const learningData = JSON.parse(fs.readFileSync('ai_learning_data.json', 'utf8'));
                this.performanceData.totalTrades = learningData.successfulTrades + learningData.failedTrades;
                this.performanceData.successfulTrades = learningData.successfulTrades;
                this.performanceData.failedTrades = learningData.failedTrades;
                this.performanceData.totalProfit = learningData.totalProfit;
                this.performanceData.totalLoss = learningData.totalLoss;
                this.performanceData.totalGasCosts = learningData.gasCosts;
            }

            // Calculate derived metrics
            this.performanceData.winRate = this.performanceData.totalTrades > 0 ?
                (this.performanceData.successfulTrades / this.performanceData.totalTrades) * 100 : 0;

            this.performanceData.averageProfit = this.performanceData.successfulTrades > 0 ?
                this.performanceData.totalProfit / this.performanceData.successfulTrades : 0;

            this.performanceData.averageLoss = this.performanceData.failedTrades > 0 ?
                this.performanceData.totalLoss / this.performanceData.failedTrades : 0;

            // Calculate trades per hour
            const hoursRunning = (Date.now() - this.startTime) / (1000 * 60 * 60);
            this.performanceData.tradesPerHour = hoursRunning > 0 ?
                this.performanceData.totalTrades / hoursRunning : 0;

            // Calculate gas efficiency
            const totalSpent = this.performanceData.totalProfit + this.performanceData.totalLoss;
            this.performanceData.gasEfficiency = totalSpent > 0 ?
                (this.performanceData.totalGasCosts / totalSpent) * 100 : 0;

        } catch (error) {
            console.log('⚠️ Failed to update performance data:', error.message);
        }
    }

    async displayPerformanceReport() {
        console.clear();
        console.log('='.repeat(80));
        console.log('🤖 AI LEARNING TRADING BOT - REAL-TIME PERFORMANCE MONITOR');
        console.log('='.repeat(80));
        console.log(`⏰ Time Running: ${this.formatTime(Date.now() - this.startTime)}`);
        console.log(`💰 Current Balance: ${this.performanceData.currentBalance.toFixed(6)} MATIC`);
        console.log(`📈 Net Profit: ${this.performanceData.netProfit >= 0 ? '+' : ''}${this.performanceData.netProfit.toFixed(6)} MATIC (${this.performanceData.profitPercentage >= 0 ? '+' : ''}${this.performanceData.profitPercentage.toFixed(2)}%)`);
        console.log('');

        console.log('📊 TRADING STATISTICS:');
        console.log(`🎯 Total Trades: ${this.performanceData.totalTrades}`);
        console.log(`✅ Successful: ${this.performanceData.successfulTrades}`);
        console.log(`❌ Failed: ${this.performanceData.failedTrades}`);
        console.log(`🏆 Win Rate: ${this.performanceData.winRate.toFixed(1)}%`);
        console.log(`⚡ Trades/Hour: ${this.performanceData.tradesPerHour.toFixed(1)}`);
        console.log('');

        console.log('💵 PROFIT ANALYSIS:');
        console.log(`📈 Total Profit: +${this.performanceData.totalProfit.toFixed(6)} MATIC`);
        console.log(`📉 Total Loss: -${this.performanceData.totalLoss.toFixed(6)} MATIC`);
        console.log(`⛽ Gas Costs: ${this.performanceData.totalGasCosts.toFixed(6)} MATIC`);
        console.log(`🎯 Avg Profit/Trade: +${this.performanceData.averageProfit.toFixed(6)} MATIC`);
        console.log(`⚠️  Avg Loss/Trade: -${this.performanceData.averageLoss.toFixed(6)} MATIC`);
        console.log(`🔥 Gas Efficiency: ${this.performanceData.gasEfficiency.toFixed(1)}%`);
        console.log('');

        // AI Learning Status
        if (fs.existsSync('ai_learning_data.json')) {
            const learningData = JSON.parse(fs.readFileSync('ai_learning_data.json', 'utf8'));
            console.log('🧠 AI LEARNING STATUS:');
            console.log(`🎓 Adaptations Made: ${learningData.adaptationCount || 0}`);
            console.log(`📚 Learning Data Points: ${this.performanceData.totalTrades}`);
            console.log(`🎯 AI Confidence: ${this.performanceData.winRate > 50 ? 'HIGH' : this.performanceData.winRate > 30 ? 'MEDIUM' : 'LOW'}`);
            console.log('');
        }

        // Performance indicators
        console.log('🎯 PERFORMANCE INDICATORS:');
        const profitIndicator = this.performanceData.netProfit > 0 ? '🟢' : '🔴';
        const winRateIndicator = this.performanceData.winRate > 60 ? '🟢' : this.performanceData.winRate > 40 ? '🟡' : '🔴';
        const gasIndicator = this.performanceData.gasEfficiency < 20 ? '🟢' : this.performanceData.gasEfficiency < 40 ? '🟡' : '🔴';

        console.log(`${profitIndicator} Profit Status: ${this.performanceData.netProfit > 0 ? 'POSITIVE' : 'NEGATIVE'}`);
        console.log(`${winRateIndicator} Win Rate: ${this.performanceData.winRate > 60 ? 'EXCELLENT' : this.performanceData.winRate > 40 ? 'GOOD' : 'NEEDS IMPROVEMENT'}`);
        console.log(`${gasIndicator} Gas Efficiency: ${this.performanceData.gasEfficiency < 20 ? 'EXCELLENT' : this.performanceData.gasEfficiency < 40 ? 'GOOD' : 'HIGH COST'}`);
        console.log('');

        // Recommendations
        console.log('💡 AI RECOMMENDATIONS:');
        if (this.performanceData.winRate < 30) {
            console.log('⚠️  LOW WIN RATE: AI is adapting strategy to be more conservative');
        } else if (this.performanceData.winRate > 70) {
            console.log('🚀 HIGH WIN RATE: AI is becoming more aggressive');
        }

        if (this.performanceData.gasEfficiency > 50) {
            console.log('⛽ HIGH GAS COSTS: AI is waiting for better market conditions');
        }

        if (this.performanceData.netProfit < 0) {
            console.log('📉 NEGATIVE PROFIT: AI is learning from losses and adapting');
        } else {
            console.log('📈 POSITIVE PROFIT: AI strategy is working effectively');
        }

        console.log('='.repeat(80));
    }

    async analyzeTrends() {
        // Analyze recent performance trends
        if (this.performanceData.totalTrades < 5) return;

        const recentTrades = this.performanceData.totalTrades;
        const recentSuccess = this.performanceData.successfulTrades;
        const recentWinRate = (recentSuccess / recentTrades) * 100;

        // Simple trend analysis
        if (recentWinRate > 60) {
            console.log('📈 TREND: Performance improving - AI is learning effectively');
        } else if (recentWinRate < 30) {
            console.log('📉 TREND: Performance declining - AI is adapting strategy');
        } else {
            console.log('➡️  TREND: Performance stable - AI maintaining current strategy');
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop() {
        this.isRunning = false;
        console.log('🛑 AI Learning Monitor Stopped');
    }
}

// Start the monitor
async function startMonitor() {
    try {
        const monitor = new AILearningMonitor();
        await monitor.initialize();
        await monitor.start();
    } catch (error) {
        console.error('❌ Failed to start AI Learning Monitor:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal...');
    process.exit(0);
});

// Start the monitor
startMonitor();
