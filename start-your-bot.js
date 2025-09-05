#!/usr/bin/env node

import AdvancedLearningTradingBot from './dist/src/advanced-trading-bot.js';

const WALLET_ADDRESS = '0x6C14Aef8B5AB704abB3f9faF409c6fb304d3f04F';
const PRIVATE_KEY = '0xb93138aabe8248db0576c148d91af416ee6692e957b85594c52b5087bf22af49';

console.log('🚀 Connecting Advanced Trading Bot to Your Wallet...');
console.log(`📍 Wallet: ${WALLET_ADDRESS}`);
console.log('🎯 Target: $3M Reserve');
console.log('💰 Micro transactions with net profit only');
console.log('⏳ Starting bot...\n');

async function startBot() {
  try {
    const bot = new AdvancedLearningTradingBot(WALLET_ADDRESS, PRIVATE_KEY);

    console.log('✅ Bot initialized successfully');
    console.log('🧠 Starting AI learning and web scraping...');
    console.log('📊 Beginning micro-profit trading...\n');

    await bot.start();

    // Monitor the bot
    setInterval(() => {
      const stats = bot.getStats();
      console.log(`\n📊 Bot Status Update:`);
      console.log(`💰 Reserve: $${stats.currentReserve.toLocaleString()}`);
      console.log(`🎯 Progress: ${stats.progressToGoal.toFixed(4)}%`);
      console.log(`📈 Trades: ${stats.totalTrades} (${stats.winRate} win rate)`);
      console.log(`💵 Total Profit: $${stats.totalProfit.toFixed(6)}`);
      console.log(`🧠 Learning Samples: ${stats.learningSamples}`);
      console.log(`📡 Active Signals: ${stats.activeSignals}`);

      if (stats.currentReserve >= stats.reserveGoal) {
        console.log('\n🎉 CONGRATULATIONS! $3M RESERVE ACHIEVED!');
        process.exit(0);
      }
    }, 60000); // Update every minute

  } catch (error) {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

startBot();
