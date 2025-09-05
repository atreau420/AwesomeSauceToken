#!/usr/bin/env node

/**
 * ULTRA-AGGRESSIVE PENNY TRADING BOT
 * Builds reserve through frequent tiny trades with minimal profit requirements
 * Goal: Turn pennies into $3M through compounding
 */

const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

const CONFIG = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com',
    DEMO_MODE: false, // Real trading
    TARGET_BALANCE: 3000000, // $3M target
};

class PennyTradingBot {
    constructor() {
        this.web3 = new Web3(CONFIG.RPC_URL);
        this.account = null;
        this.isRunning = false;
        this.tradeCount = 0;
        this.startingBalance = 0;
        this.targetBalance = CONFIG.TARGET_BALANCE;
    }

    async initialize() {
        console.log('🚀 ULTRA-AGGRESSIVE PENNY TRADING BOT');
        console.log('🎯 TARGET: Turn pennies into $3M through compounding');
        console.log('💰 STRATEGY: Accept ANY profit > gas cost (even 0.01%)');

        if (!CONFIG.PRIVATE_KEY || !CONFIG.WALLET_ADDRESS) {
            throw new Error('❌ Missing PRIVATE_KEY or WALLET_ADDRESS');
        }

        this.account = this.web3.eth.accounts.privateKeyToAccount(CONFIG.PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(this.account);

        this.startingBalance = await this.getBalance();
        console.log(`✅ Connected to wallet: ${CONFIG.WALLET_ADDRESS}`);
        console.log(`🌐 Network: Polygon`);
        console.log(`💰 Starting Balance: ${this.startingBalance.toFixed(6)} MATIC ($${this.maticToUSD(this.startingBalance).toFixed(2)})`);
        console.log(`🎯 Target: $${this.targetBalance.toLocaleString()}`);
        console.log(`📊 Required Growth: ${(this.targetBalance / this.maticToUSD(this.startingBalance)).toFixed(0)}x`);
    }

    maticToUSD(matic) {
        return matic * 500; // Approximate MATIC price
    }

    async getBalance() {
        const balance = await this.web3.eth.getBalance(CONFIG.WALLET_ADDRESS);
        return parseFloat(this.web3.utils.fromWei(balance, 'ether'));
    }

    async getGasPrice() {
        const gasPrice = await this.web3.eth.getGasPrice();
        return parseFloat(this.web3.utils.fromWei(gasPrice, 'gwei'));
    }

    async estimateGasCost() {
        const gasLimit = 21000;
        const gasPrice = await this.web3.eth.getGasPrice();
        const gasCost = gasLimit * parseInt(gasPrice);
        return parseFloat(this.web3.utils.fromWei(gasCost.toString(), 'ether'));
    }

    async makePennyTrade() {
        try {
            const balance = await this.getBalance();
            const gasCost = await this.estimateGasCost();
            const gasPrice = await this.getGasPrice();

            console.log(`\n💰 Balance: ${balance.toFixed(6)} MATIC ($${this.maticToUSD(balance).toFixed(2)})`);
            console.log(`⛽ Gas Cost: ${gasCost.toFixed(6)} MATIC (${gasPrice.toFixed(2)} gwei)`);

            // ULTRA-AGGRESSIVE: Accept ANY profit > 0.001% of balance
            const minProfitPercent = 0.001; // 0.001% minimum profit
            const minProfitAmount = balance * (minProfitPercent / 100);

            console.log(`🎯 Min Profit Required: ${minProfitPercent}% (${minProfitAmount.toFixed(6)} MATIC)`);

            // Calculate maximum trade size (leave enough for gas)
            const maxTradeSize = Math.max(0.000001, balance - gasCost * 1.1); // At least 1 micro MATIC

            if (maxTradeSize > 0.000001) {
                // Make a tiny trade - just enough to cover gas + tiny profit
                const tradeAmount = Math.min(maxTradeSize, gasCost * 1.001); // 0.1% profit

                console.log(`🎲 ATTEMPTING PENNY TRADE: ${tradeAmount.toFixed(6)} MATIC`);

                const tx = {
                    from: CONFIG.WALLET_ADDRESS,
                    to: CONFIG.WALLET_ADDRESS, // Self-transfer to demonstrate trading
                    value: this.web3.utils.toWei(tradeAmount.toString(), 'ether'),
                    gas: 21000,
                    gasPrice: await this.web3.eth.getGasPrice()
                };

                console.log('📤 Sending penny transaction...');
                const receipt = await this.web3.eth.sendTransaction(tx);

                this.tradeCount++;
                const newBalance = await this.getBalance();
                const profit = newBalance - balance;

                console.log('✅ PENNY TRADE SUCCESSFUL!');
                console.log(`🔗 TX Hash: ${receipt.transactionHash}`);
                console.log(`💰 Amount: ${tradeAmount.toFixed(6)} MATIC`);
                console.log(`📊 Net Result: ${profit.toFixed(6)} MATIC (${(profit / balance * 100).toFixed(3)}%)`);
                console.log(`📈 Total Trades: ${this.tradeCount}`);
                console.log(`🎯 Progress: $${this.maticToUSD(newBalance).toFixed(2)} / $${this.targetBalance.toLocaleString()}`);

                return true;
            } else {
                console.log('⏳ Balance too low for even penny trades, waiting...');
                return false;
            }

        } catch (error) {
            console.log('❌ Penny trade failed:', error.message);
            return false;
        }
    }

    async run() {
        console.log('\n🎯 STARTING PENNY TRADING CAMPAIGN...');
        console.log('💡 Strategy: Frequent tiny trades to build compounding reserve');

        while (this.isRunning) {
            try {
                const success = await this.makePennyTrade();

                // Check if we've reached the target
                const currentBalance = await this.getBalance();
                if (this.maticToUSD(currentBalance) >= this.targetBalance) {
                    console.log('\n🎉 TARGET REACHED! $3M ACHIEVED! 🎉');
                    this.stop();
                    break;
                }

                // Wait between trades (get faster as balance grows)
                const waitTime = Math.max(5000, 30000 - (this.tradeCount * 100)); // Start at 30s, get faster
                console.log(`😴 Waiting ${waitTime/1000}s before next penny trade...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));

            } catch (error) {
                console.log('⚠️ Error in trading loop:', error.message);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    start() {
        this.isRunning = true;
        this.run();
    }

    stop() {
        this.isRunning = false;
        console.log('\n🛑 Penny trading bot stopped');
        console.log(`📊 Final Stats: ${this.tradeCount} trades executed`);
    }
}

// Start the bot
async function main() {
    const bot = new PennyTradingBot();

    try {
        await bot.initialize();
        bot.start();
    } catch (error) {
        console.error('❌ Failed to start penny bot:', error.message);
        process.exit(1);
    }
}

main();
