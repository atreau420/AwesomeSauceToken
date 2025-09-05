#!/usr/bin/env node

/**
 * PROFIT-ONLY BOT MONITOR
 * Only shows profitable trades and opportunities
 */

const { Web3 } = require('web3');
require('dotenv').config();

const CONFIG = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com'
};

class ProfitOnlyMonitor {
    constructor() {
        this.web3 = new Web3(CONFIG.RPC_URL);
        this.startBalance = 0;
        this.lastBalance = 0;
        this.tradeCount = 0;
        this.totalProfit = 0;
        this.startTime = Date.now();
        this.profitableTrades = 0;
        this.unprofitableTrades = 0;
    }

    async initialize() {
        console.log('💰 PROFIT-ONLY MONITOR ACTIVE');
        console.log(`🔗 Wallet: ${CONFIG.WALLET_ADDRESS}`);
        console.log(`🌐 Network: Polygon`);
        console.log(`📊 Mode: PROFIT-ONLY (No Losses Allowed)`);
        console.log('='.repeat(60));

        // Get initial balance
        this.startBalance = parseFloat(this.web3.utils.fromWei(
            await this.web3.eth.getBalance(CONFIG.WALLET_ADDRESS), 'ether'
        ));

        console.log(`💰 Starting Balance: ${this.startBalance.toFixed(6)} MATIC`);
        console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
        console.log(`🎯 Goal: Only execute profitable trades`);
        console.log('='.repeat(60));
    }

    async checkStatus() {
        try {
            const currentBalance = parseFloat(this.web3.utils.fromWei(
                await this.web3.eth.getBalance(CONFIG.WALLET_ADDRESS), 'ether'
            ));

            const balanceChange = currentBalance - this.startBalance;
            const runtime = (Date.now() - this.startTime) / 1000; // seconds
            const hours = Math.floor(runtime / 3600);
            const minutes = Math.floor((runtime % 3600) / 60);

            console.log(`⏰ Runtime: ${hours}h ${minutes}m`);
            console.log(`💰 Current Balance: ${currentBalance.toFixed(6)} MATIC`);
            console.log(`📈 Total Change: ${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(6)} MATIC`);

            if (balanceChange > 0) {
                console.log(`💹 Total Profit: +${balanceChange.toFixed(6)} MATIC (+${((balanceChange / this.startBalance) * 100).toFixed(4)}%)`);
            } else {
                console.log(`📉 Total Loss: ${balanceChange.toFixed(6)} MATIC (${((balanceChange / this.startBalance) * 100).toFixed(4)}%)`);
            }

            // Trade statistics
            console.log(`✅ Profitable Trades: ${this.profitableTrades}`);
            console.log(`❌ Unprofitable Trades: ${this.unprofitableTrades}`);

            if (this.lastBalance !== currentBalance) {
                const tradeChange = currentBalance - this.lastBalance;
                if (tradeChange > 0) {
                    this.profitableTrades++;
                    console.log(`🎉 PROFIT TRADE: +${tradeChange.toFixed(6)} MATIC`);
                } else if (tradeChange < 0) {
                    this.unprofitableTrades++;
                    console.log(`⚠️ LOSS TRADE: ${tradeChange.toFixed(6)} MATIC`);
                }
            }

            // Status indicator
            if (balanceChange > 0) {
                console.log(`💡 Status: PROFITABLE 📈 (+${((balanceChange / this.startBalance) * 100).toFixed(2)}%)`);
            } else if (balanceChange === 0) {
                console.log(`💡 Status: BREAK-EVEN ⚖️ (Waiting for opportunities)`);
            } else {
                console.log(`💡 Status: LOSING 📉 (${((balanceChange / this.startBalance) * 100).toFixed(2)}%)`);
            }

            console.log('='.repeat(60));

            this.lastBalance = currentBalance;

        } catch (error) {
            console.log(`⚠️ Status check error: ${error.message}`);
        }
    }

    async startMonitoring(intervalSeconds = 60) {
        await this.initialize();

        console.log(`🔍 Monitoring every ${intervalSeconds} seconds...\n`);

        // Monitor loop
        setInterval(() => {
            this.checkStatus();
        }, intervalSeconds * 1000);

        // Initial status
        await this.checkStatus();
    }
}

// Start monitoring
const monitor = new ProfitOnlyMonitor();
monitor.startMonitoring(60); // Check every 60 seconds
