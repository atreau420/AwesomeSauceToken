#!/usr/bin/env node

/**
 * Standalone Trading Bot Runner
 * Run this script to start the automated trading bot for passive income generation
 */

import { startTradingBot, getBotStatus } from './src/trading-bots.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🤖 AwesomeSauceToken Auto Trading Bot');
  console.log('=====================================');

  // Check environment variables
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in environment variables');
    console.log('Please set your PRIVATE_KEY in the .env file');
    process.exit(1);
  }

  if (!process.env.RPC_URL || process.env.RPC_URL.includes('YOUR_INFURA_KEY')) {
    console.error('❌ RPC_URL not properly configured');
    console.log('Please set a valid RPC_URL in the .env file');
    process.exit(1);
  }

  console.log('✅ Environment variables configured');
  console.log(`📊 Token Address: ${process.env.TOKEN_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'}`);
  console.log(`💰 Min Trade Amount: ${process.env.MIN_TRADE_AMOUNT || '0.001'} ETH`);
  console.log(`⏰ Trade Interval: ${process.env.TRADE_INTERVAL || '5'} minutes`);
  console.log(`📈 Profit Threshold: ${process.env.PROFIT_THRESHOLD || '1.0'}%`);
  console.log('');

  try {
    console.log('🚀 Starting trading bot...');
    const result = await startTradingBot();
    console.log(result);

    // Keep the process running
    console.log('');
    console.log('✅ Bot is now running in the background');
    console.log('💡 The bot will automatically execute trades every few minutes');
    console.log('📊 Check the website dashboard for real-time status');
    console.log('🛑 Press Ctrl+C to stop the bot');

    // Status update loop
    setInterval(() => {
      const status = getBotStatus();
      console.log(`📊 ${new Date().toLocaleTimeString()}: ${status}`);
    }, 60000); // Update every minute

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('');
  console.log('🛑 Received shutdown signal...');
  console.log('✅ Bot stopped successfully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('');
  console.log('🛑 Received termination signal...');
  console.log('✅ Bot stopped successfully');
  process.exit(0);
});

// Run the bot
main().catch(console.error);
