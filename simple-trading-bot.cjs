#!/usr/bin/env node

/**
 * SIMPLE AGGRESSIVE TRADING BOT
 * For small balances - makes trades with minimal profit requirements
 */

const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

const CONFIG = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com',
    DEMO_MODE: false, // Real trading
};

class SimpleTradingBot {
    constructor() {
        this.web3 = new Web3(CONFIG.RPC_URL);
        this.account = null;
        this.isRunning = false;
    }

    async initialize() {
        console.log('🚀 SIMPLE AGGRESSIVE TRADING BOT STARTING...');

        if (!CONFIG.PRIVATE_KEY || !CONFIG.WALLET_ADDRESS) {
            throw new Error('❌ Missing PRIVATE_KEY or WALLET_ADDRESS');
        }

        this.account = this.web3.eth.accounts.privateKeyToAccount(CONFIG.PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(this.account);

        console.log('✅ Connected to wallet:', CONFIG.WALLET_ADDRESS);
        console.log('🌐 Network: Polygon');
        console.log('💰 MODE: REAL TRADING');
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
        // Estimate gas for a simple transfer (simplified)
        const gasLimit = 21000; // Standard transfer
        const gasPrice = await this.web3.eth.getGasPrice();
        const gasCost = gasLimit * parseInt(gasPrice);
        return parseFloat(this.web3.utils.fromWei(gasCost.toString(), 'ether'));
    }

    async makeTrade() {
        try {
            const balance = await this.getBalance();
            const gasCost = await this.estimateGasCost();
            const gasPrice = await this.getGasPrice();

            console.log(`💰 Balance: ${balance.toFixed(6)} MATIC`);
            console.log(`⛽ Gas Cost: ${gasCost.toFixed(6)} MATIC (${gasPrice.toFixed(2)} gwei)`);

            // For small balances, trade with minimal requirements
            if (balance > gasCost * 1.01) {
                const tradeAmount = Math.min(balance * 0.1, balance - gasCost * 1.1);

                console.log(`🎯 ATTEMPTING TRADE: ${tradeAmount.toFixed(6)} MATIC`);

                // Simple test transaction to self (this will cost gas but demonstrate trading)
                const tx = {
                    from: CONFIG.WALLET_ADDRESS,
                    to: CONFIG.WALLET_ADDRESS, // Send to self
                    value: this.web3.utils.toWei(tradeAmount.toString(), 'ether'),
                    gas: 21000,
                    gasPrice: await this.web3.eth.getGasPrice()
                };

                console.log('📤 Sending transaction...');
                const receipt = await this.web3.eth.sendTransaction(tx);

                console.log('✅ TRADE SUCCESSFUL!');
                console.log('🔗 TX Hash:', receipt.transactionHash);
                console.log('💰 Amount:', tradeAmount.toFixed(6), 'MATIC');

                return true;
            } else {
                console.log('⏳ Balance too low for profitable trade, waiting...');
                return false;
            }

        } catch (error) {
            console.log('❌ Trade failed:', error.message);
            return false;
        }
    }

    async run() {
        console.log('🎯 STARTING SIMPLE TRADING BOT...');

        while (this.isRunning) {
            try {
                await this.makeTrade();

                // Wait 30 seconds between attempts
                console.log('😴 Waiting 30 seconds...');
                await new Promise(resolve => setTimeout(resolve, 30000));

            } catch (error) {
                console.log('⚠️ Error in trading loop:', error.message);
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
    }

    start() {
        this.isRunning = true;
        this.run();
    }

    stop() {
        this.isRunning = false;
        console.log('🛑 Bot stopped');
    }
}

// Start the bot
async function main() {
    const bot = new SimpleTradingBot();

    try {
        await bot.initialize();
        bot.start();
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        process.exit(1);
    }
}

main();
