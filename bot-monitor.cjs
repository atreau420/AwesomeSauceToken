#!/usr/bin/env node

/**
 * BOT STATUS MONITOR
 * Real-time monitoring of trading bot progress
 */

const { Web3 } = require('web3');
require('dotenv').config();

const CONFIG = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com'
};

class BotMonitor {
    constructor() {
        this.web3 = new Web3(CONFIG.RPC_URL);
        this.startBalance = 0;
        this.lastBalance = 0;
        this.tradeCount = 0;
        this.startTime = Date.now();
    }

    async initialize() {
        console.log('📊 Starting Bot Status Monitor...');
        console.log(`🔗 Wallet: ${CONFIG.WALLET_ADDRESS}`);
        console.log(`🌐 Network: Polygon\n`);

        // Get initial balance
        this.startBalance = parseFloat(this.web3.utils.fromWei(
            await this.web3.eth.getBalance(CONFIG.WALLET_ADDRESS), 'ether'
        ));

        console.log(`💰 Starting Balance: ${this.startBalance.toFixed(6)} MATIC`);
        console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);
        console.log('=' .repeat(60));
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
            const seconds = Math.floor(runtime % 60);

            console.log(`⏰ Runtime: ${hours}h ${minutes}m ${seconds}s`);
            console.log(`💰 Current Balance: ${currentBalance.toFixed(6)} MATIC`);
            console.log(`📈 Change: ${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(6)} MATIC`);
            console.log(`📊 Change %: ${((balanceChange / this.startBalance) * 100).toFixed(4)}%`);

            if (this.lastBalance !== currentBalance) {
                const tradeChange = currentBalance - this.lastBalance;
                console.log(`🎯 Last Trade: ${tradeChange >= 0 ? '+' : ''}${tradeChange.toFixed(6)} MATIC`);
                this.tradeCount++;
            }

            console.log(`🔄 Total Trades Detected: ${this.tradeCount}`);
            console.log(`💡 Status: ${balanceChange >= 0 ? 'PROFITABLE 📈' : 'BUILDING 🔨'}`);
            console.log('=' .repeat(60));

            this.lastBalance = currentBalance;

        } catch (error) {
            console.log(`⚠️ Status check error: ${error.message}`);
        }
    }

    async startMonitoring(intervalSeconds = 30) {
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
const monitor = new BotMonitor();
monitor.startMonitoring(30); // Check every 30 seconds
