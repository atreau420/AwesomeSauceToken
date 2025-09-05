#!/usr/bin/env node

/**
 * Conservative Bot Statu        console.log(`🎯 Trading Thresholds:`);
        console.log(`   Minimum Trade: ${minTradeAmount.toFixed(8)} MATIC (0.1%)`);
        console.log(`   Maximum Trade: ${maxTradeAmount.toFixed(8)} MATIC (1.0%)`);nitor
 * Shows real-time status of the conservative trading bot
 */

const { Web3 } = require('web3');
require('dotenv').config();

const CONFIG = {
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com',
    WALLET_ADDRESS: process.env.WALLET_ADDRESS
};

async function checkBotStatus() {
    console.log('📊 CONSERVATIVE TRADING BOT STATUS\n');

    if (!CONFIG.WALLET_ADDRESS) {
        console.log('❌ Wallet address not configured');
        return;
    }

    const web3 = new Web3(CONFIG.RPC_URL);

    try {
        // Check current balance
        const balance = await web3.eth.getBalance(CONFIG.WALLET_ADDRESS);
        const balanceEth = parseFloat(web3.utils.fromWei(balance, 'ether'));

        // Check gas price
        const gasPrice = await web3.eth.getGasPrice();
        const gasPriceGwei = parseFloat(web3.utils.fromWei(gasPrice.toString(), 'gwei'));
        const gasCost = parseFloat(web3.utils.fromWei((BigInt(gasPrice) * BigInt(21000)).toString(), 'ether'));

        // Conservative bot settings
        const gasReserve = gasCost * 1.5; // 1.5x gas cost reserve
        const availableForTrading = Math.max(0, balanceEth - gasReserve);

        console.log(`💰 Current Balance: ${balanceEth.toFixed(8)} MATIC`);
        console.log(`⛽ Gas Price: ${gasPriceGwei.toFixed(2)} gwei`);
        console.log(`💸 Gas Cost (21k gas): ${gasCost.toFixed(8)} MATIC`);
        console.log(`🛡️  Gas Reserve (1.5x): ${gasReserve.toFixed(8)} MATIC`);
        console.log(`💎 Available for Trading: ${availableForTrading.toFixed(8)} MATIC`);

        // Trading thresholds
        const minTradePercent = 0.001; // 0.1%
        const maxTradePercent = 0.01;  // 1%
        const minTradeAmount = availableForTrading * minTradePercent;
        const maxTradeAmount = availableForTrading * maxTradePercent;

        console.log(`\n🎯 Trading Thresholds:`);
        console.log(`   Minimum Trade: ${minTradeAmount.toFixed(8)} ETH (${(minTradePercent * 100).toFixed(1)}%)`);
        console.log(`   Maximum Trade: ${maxTradeAmount.toFixed(8)} ETH (${(maxTradePercent * 100).toFixed(1)}%)`);

        // Status assessment
        console.log(`\n📈 Status Assessment:`);
        if (balanceEth < gasReserve) {
            console.log(`❌ INSUFFICIENT BALANCE`);
            console.log(`   Need at least: ${(gasReserve * 1.1).toFixed(8)} MATIC`);
            console.log(`   Current: ${balanceEth.toFixed(8)} MATIC`);
            console.log(`   Shortfall: ${(gasReserve * 1.1 - balanceEth).toFixed(8)} MATIC`);
        } else if (availableForTrading > 0) {
            console.log(`✅ READY TO TRADE`);
            console.log(`   Can trade: ${minTradeAmount.toFixed(8)} - ${maxTradeAmount.toFixed(8)} MATIC per trade`);
            console.log(`   Conservative scaling active`);
        } else {
            console.log(`⏳ WAITING FOR MORE FUNDS`);
            console.log(`   Balance too low for safe trading`);
        }

        // Profit tracking (if initial balance was tracked)
        console.log(`\n💡 Smart Micro-Trading Strategy:`);
        console.log(`   • AI-powered decision making for $2 foundation`);
        console.log(`   • Micro-arbitrage between tokens`);
        console.log(`   • Dust collection and consolidation`);
        console.log(`   • Foundation building with compounding`);
        console.log(`   • Only trades with available funds`);
        console.log(`   • Retains 100% of profits`);
        console.log(`   • Scales trade sizes with balance growth`);
        console.log(`   • Maintains gas reserves for safety`);
        console.log(`   • Can swap between tokens for optimal trades`);
        console.log(`   • Uses QuickSwap DEX on Polygon`);

    } catch (error) {
        console.error('❌ Error checking status:', error.message);
    }
}

checkBotStatus();
