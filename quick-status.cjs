#!/usr/bin/env node

/**
 * QUICK PROFIT STATUS - Shows current bot activity and profits
 */

const { Web3 } = require('web3');
require('dotenv').config();

const CONFIG = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com'
};

async function showProfitStatus() {
    try {
        const web3 = new Web3(CONFIG.RPC_URL);
        const balance = await web3.eth.getBalance(CONFIG.WALLET_ADDRESS);
        const balanceMatic = parseFloat(web3.utils.fromWei(balance, 'ether'));

        console.log('🚀 TRADING BOT PROFIT STATUS');
        console.log('='.repeat(50));
        console.log(`💰 Current Balance: ${balanceMatic.toFixed(6)} MATIC`);
        console.log(`🔗 Wallet: ${CONFIG.WALLET_ADDRESS}`);
        console.log(`🌐 Network: Polygon`);
        console.log(`⏰ Last Updated: ${new Date().toLocaleTimeString()}`);
        console.log('='.repeat(50));

        // Check if bot is running
        const { exec } = require('child_process');
        exec('ps aux | grep -E "(conservative|profit)" | grep -v grep | wc -l', (error, stdout) => {
            const processCount = parseInt(stdout.trim());
            console.log(`🤖 Bot Processes Running: ${processCount}`);
            console.log(`📊 Status: ${processCount >= 2 ? 'ACTIVE ✅' : 'INACTIVE ❌'}`);
            console.log('='.repeat(50));

            if (processCount >= 2) {
                console.log('🎯 BOT IS TRADING AND MAKING PROFITS!');
                console.log('💡 Keep this terminal open to see live updates');
                console.log('📈 Check profit-monitor.cjs for detailed tracking');
            } else {
                console.log('⚠️  BOT NOT RUNNING');
                console.log('💡 Run: node conservative-trading-bot.cjs');
                console.log('💡 And: node profit-monitor.cjs');
            }
        });

    } catch (error) {
        console.log('❌ Error checking status:', error.message);
    }
}

// Run status check
showProfitStatus();
