#!/usr/bin/env node

import { setupWallet, startBot } from './dist/src/trading-bot-manager.js';

const WALLET_ADDRESS = '0x6C14Aef8B5AB704abB3f9faF409c6fb304d3f04F';
const PRIVATE_KEY = '0xb93138aabe8248db0576c148d91af416ee6692e957b85594c52b5087bf22af49';

async function quickSetup() {
  console.log('🚀 Quick Setup for Your Trading Bot');
  console.log('====================================');
  console.log(`📍 Wallet: ${WALLET_ADDRESS}`);
  console.log('🎯 Target: $3M Reserve');
  console.log('🧠 AI Learning: Enabled');
  console.log('💰 Profit-Only Trading: Enabled');
  console.log('');

  // Use a default password for quick setup
  const password = 'awesomesauce2025';

  console.log('🔐 Setting up wallet with secure encryption...');
  const success = await setupWallet(WALLET_ADDRESS, PRIVATE_KEY, password);

  if (success) {
    console.log('✅ Wallet setup complete!');
    console.log('');
    console.log('🚀 Starting trading bot immediately...');

    const botStarted = await startBot(WALLET_ADDRESS, password);

    if (botStarted) {
      console.log('🎉 Trading bot is now ACTIVE!');
      console.log('');
      console.log('📊 The bot will:');
      console.log('   • Scan web for trading signals');
      console.log('   • Execute only profitable trades');
      console.log('   • Build your $3M reserve');
      console.log('   • Learn and adapt continuously');
      console.log('');
      console.log('💰 Watch your wallet for immediate trading activity!');
      console.log('');
      console.log('📈 Check progress with: npm run trading-bot:stats');
    } else {
      console.log('❌ Failed to start trading bot');
    }
  } else {
    console.log('❌ Wallet setup failed');
  }
}

quickSetup().catch(console.error);
