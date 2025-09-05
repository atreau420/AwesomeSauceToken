#!/usr/bin/env node

/**
 * GAS-EFFICIENT AI BOT MONITOR
 * Real-time monitoring for the gas-optimized AI learning bot
 */

const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

class GasEfficientAIMonitor {
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
            gasEfficiency: 0,
            profitToGasRatio: 0,
            bestGasPrice: Infinity,
            worstGasPrice: 0
        };
    }

    async initialize() {
        console.log('📊 GAS-EFFICIENT AI BOT MONITOR INITIALIZING...');

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
        console.log(`📊 Gas-efficient monitoring: ACTIVE`);

        return true;
    }

    async start() {
        if (this.isRunning) {
            console.log('📊 Gas-Efficient Monitor is already running');
            return;
        }

        console.log('📊 Starting Gas-Efficient AI Learning Bot Monitor...');
        this.isRunning = true;

        while (this.isRunning) {
            try {
                await this.updatePerformanceData();
                await this.displayPerformanceReport();
                await this.analyzeGasEfficiency();

                await this.sleep(15000); // Update every 15 seconds

            } catch (error) {
                console.log(`⚠️ Monitor error: ${error.message}`);
                await this.sleep(10000);
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

            // Load learning data from gas-efficient AI bot
            if (fs.existsSync('gas_efficient_learning_data.json')) {
                const learningData = JSON.parse(fs.readFileSync('gas_efficient_learning_data.json', 'utf8'));
                this.performanceData.totalTrades = learningData.successfulTrades + learningData.failedTrades;
                this.performanceData.successfulTrades = learningData.successfulTrades;
                this.performanceData.failedTrades = learningData.failedTrades;
                this.performanceData.totalProfit = learningData.totalProfit;
                this.performanceData.totalLoss = learningData.totalLoss;
                this.performanceData.totalGasCosts = learningData.gasCosts;
                this.performanceData.gasEfficiency = learningData.gasEfficiency;
                this.performanceData.bestGasPrice = learningData.bestGasPrice;
                this.performanceData.worstGasPrice = learningData.worstGasPrice;
            }

            // Calculate derived metrics
            this.performanceData.winRate = this.performanceData.totalTrades > 0 ?
                (this.performanceData.successfulTrades / this.performanceData.totalTrades) * 100 : 0;

            this.performanceData.averageProfit = this.performanceData.successfulTrades > 0 ?
                this.performanceData.totalProfit / this.performanceData.successfulTrades : 0;

            this.performanceData.averageLoss = this.performanceData.failedTrades > 0 ?
                this.performanceData.totalLoss / this.performanceData.failedTrades : 0;

            // Calculate profit to gas ratio
            const totalVolume = this.performanceData.totalProfit + this.performanceData.totalLoss;
            this.performanceData.profitToGasRatio = totalVolume > 0 ?
                totalVolume / this.performanceData.totalGasCosts : 0;

        } catch (error) {
            console.log('⚠️ Failed to update performance data:', error.message);
        }
    }

    async displayPerformanceReport() {
        console.clear();
        console.log('='.repeat(80));
        console.log('🤖 GAS-EFFICIENT AI LEARNING TRADING BOT - REAL-TIME MONITOR');
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
        console.log('');

        console.log('💵 PROFIT ANALYSIS:');
        console.log(`📈 Total Profit: +${this.performanceData.totalProfit.toFixed(6)} MATIC`);
        console.log(`📉 Total Loss: -${this.performanceData.totalLoss.toFixed(6)} MATIC`);
        console.log(`⛽ Gas Costs: ${this.performanceData.totalGasCosts.toFixed(6)} MATIC`);
        console.log(`🎯 Avg Profit/Trade: +${this.performanceData.averageProfit.toFixed(6)} MATIC`);
        console.log(`⚠️  Avg Loss/Trade: -${this.performanceData.averageLoss.toFixed(6)} MATIC`);
        console.log('');

        console.log('⛽ GAS EFFICIENCY ANALYSIS:');
        console.log(`🔥 Gas Efficiency: ${this.performanceData.gasEfficiency.toFixed(1)}%`);
        console.log(`📊 Profit/Gas Ratio: ${this.performanceData.profitToGasRatio.toFixed(1)}x`);
        console.log(`💹 Best Gas Price: ${this.performanceData.bestGasPrice === Infinity ? 'N/A' : this.performanceData.bestGasPrice.toFixed(2) + ' gwei'}`);
        console.log(`⚠️  Worst Gas Price: ${this.performanceData.worstGasPrice === 0 ? 'N/A' : this.performanceData.worstGasPrice.toFixed(2) + ' gwei'}`);
        console.log('');

        // Performance indicators
        console.log('🎯 PERFORMANCE INDICATORS:');
        const profitIndicator = this.performanceData.netProfit > 0 ? '🟢' : '🔴';
        const gasIndicator = this.performanceData.gasEfficiency < 30 ? '🟢' : this.performanceData.gasEfficiency < 50 ? '🟡' : '🔴';
        const ratioIndicator = this.performanceData.profitToGasRatio > 3 ? '🟢' : this.performanceData.profitToGasRatio > 2 ? '🟡' : '🔴';

        console.log(`${profitIndicator} Profit Status: ${this.performanceData.netProfit > 0 ? 'POSITIVE' : 'NEGATIVE'}`);
        console.log(`${gasIndicator} Gas Efficiency: ${this.performanceData.gasEfficiency < 30 ? 'EXCELLENT' : this.performanceData.gasEfficiency < 50 ? 'GOOD' : 'HIGH COST'}`);
        console.log(`${ratioIndicator} Profit/Gas Ratio: ${this.performanceData.profitToGasRatio > 3 ? 'EXCELLENT' : this.performanceData.profitToGasRatio > 2 ? 'GOOD' : 'NEEDS IMPROVEMENT'}`);
        console.log('');

        // Gas-efficient AI recommendations
        console.log('💡 GAS-EFFICIENT AI RECOMMENDATIONS:');
        if (this.performanceData.gasEfficiency > 50) {
            console.log('⛽ CRITICAL: Gas costs are too high! Bot will wait for better conditions.');
        } else if (this.performanceData.gasEfficiency < 20) {
            console.log('🟢 EXCELLENT: Gas efficiency is optimal for profitable trading.');
        }

        if (this.performanceData.profitToGasRatio < 2) {
            console.log('⚠️  LOW RATIO: Profits barely cover gas costs. Bot is being very conservative.');
        } else if (this.performanceData.profitToGasRatio > 4) {
            console.log('🚀 HIGH RATIO: Excellent profit-to-gas ratio! Strategy is working well.');
        }

        if (this.performanceData.winRate < 50) {
            console.log('🎯 LOW WIN RATE: AI is adapting strategy for better gas efficiency.');
        } else {
            console.log('🏆 HIGH WIN RATE: AI strategy is gas-efficient and profitable.');
        }

        console.log('='.repeat(80));
    }

    async analyzeGasEfficiency() {
        // Analyze gas efficiency trends
        if (this.performanceData.totalTrades < 2) return;

        const currentEfficiency = this.performanceData.gasEfficiency;
        const targetEfficiency = 30; // Target: gas costs < 30% of volume

        if (currentEfficiency > targetEfficiency) {
            console.log('📉 GAS EFFICIENCY TREND: Above target, bot will be more selective');
        } else {
            console.log('📈 GAS EFFICIENCY TREND: Within target, bot optimizing for profits');
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
        console.log('🛑 Gas-Efficient AI Monitor Stopped');
    }
}

// Start the monitor
async function startGasEfficientMonitor() {
    try {
        const monitor = new GasEfficientAIMonitor();
        await monitor.initialize();
        await monitor.start();
    } catch (error) {
        console.error('❌ Failed to start Gas-Efficient Monitor:', error.message);
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
startGasEfficientMonitor();
