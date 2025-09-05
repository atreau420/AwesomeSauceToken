#!/usr/bin/env node

import readline from 'readline';
import { setupWallet, startBot, stopBot, getStats, listWallets, emergencyStop } from './dist/src/trading-bot-manager.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function mainMenu() {
  console.log('\n🚀 AwesomeSauceToken Advanced Trading Bot Setup');
  console.log('================================================');
  console.log('1. Setup New Wallet');
  console.log('2. Start Trading Bot');
  console.log('3. Stop Trading Bot');
  console.log('4. View Bot Statistics');
  console.log('5. List Wallets');
  console.log('6. Emergency Stop');
  console.log('7. Exit');
  console.log('================================================');

  const choice = await ask('Choose an option (1-7): ');

  switch (choice) {
    case '1':
      await setupWalletMenu();
      break;
    case '2':
      await startBotMenu();
      break;
    case '3':
      await stopBotMenu();
      break;
    case '4':
      await viewStatsMenu();
      break;
    case '5':
      await listWalletsMenu();
      break;
    case '6':
      await emergencyStopMenu();
      break;
    case '7':
      console.log('👋 Goodbye!');
      rl.close();
      return;
    default:
      console.log('❌ Invalid choice. Please try again.');
  }

  // Continue to main menu
  setTimeout(mainMenu, 1000);
}

async function setupWalletMenu() {
  console.log('\n🔐 Wallet Setup');
  console.log('================');

  const walletAddress = await ask('Enter your wallet address: ');
  const privateKey = await ask('Enter your private key (will be encrypted): ');
  const password = await ask('Create a password to protect your wallet: ');
  const confirmPassword = await ask('Confirm password: ');

  if (password !== confirmPassword) {
    console.log('❌ Passwords do not match!');
    return;
  }

  if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
    console.log('❌ Invalid wallet address format!');
    return;
  }

  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    console.log('❌ Invalid private key format!');
    return;
  }

  console.log('\n🔒 Setting up wallet...');
  const success = await setupWallet(walletAddress, privateKey, password);

  if (success) {
    console.log('✅ Wallet setup complete!');
    console.log('💡 Your private key is now encrypted and secure.');
    console.log('🚀 You can now start the trading bot from the main menu.');
  }
}

async function startBotMenu() {
  console.log('\n🤖 Start Trading Bot');
  console.log('====================');

  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log('❌ No wallets configured. Please setup a wallet first.');
    return;
  }

  console.log('Available wallets:');
  wallets.forEach((wallet, index) => {
    console.log(`${index + 1}. ${wallet}`);
  });

  const walletChoice = await ask('Choose wallet number: ');
  const walletIndex = parseInt(walletChoice) - 1;

  if (walletIndex < 0 || walletIndex >= wallets.length) {
    console.log('❌ Invalid wallet choice!');
    return;
  }

  const selectedWallet = wallets[walletIndex];
  const password = await ask('Enter wallet password: ');

  console.log('\n🚀 Starting Advanced Learning Trading Bot...');
  console.log('🎯 Target: Build $3M reserve');
  console.log('🧠 Features: AI learning, web scraping, risk management');
  console.log('💰 Only profitable trades (gas fees included)');
  console.log('⏰ This may take a few minutes to initialize...');

  const success = await startBot(selectedWallet, password);

  if (success) {
    console.log('\n✅ Trading bot started successfully!');
    console.log('📊 The bot will:');
    console.log('   • Scan web for trading signals');
    console.log('   • Learn from market patterns');
    console.log('   • Only execute profitable trades');
    console.log('   • Build your reserve to $3M');
    console.log('   • Monitor and adjust strategy automatically');
  }
}

async function stopBotMenu() {
  console.log('\n🛑 Stop Trading Bot');
  console.log('===================');

  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log('❌ No wallets configured.');
    return;
  }

  console.log('Available wallets:');
  wallets.forEach((wallet, index) => {
    console.log(`${index + 1}. ${wallet}`);
  });

  const walletChoice = await ask('Choose wallet number: ');
  const walletIndex = parseInt(walletChoice) - 1;

  if (walletIndex < 0 || walletIndex >= wallets.length) {
    console.log('❌ Invalid wallet choice!');
    return;
  }

  const selectedWallet = wallets[walletIndex];
  const success = await stopBot(selectedWallet);

  if (success) {
    console.log('✅ Trading bot stopped successfully!');
  }
}

async function viewStatsMenu() {
  console.log('\n📊 Bot Statistics');
  console.log('=================');

  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log('❌ No wallets configured.');
    return;
  }

  console.log('Available wallets:');
  wallets.forEach((wallet, index) => {
    console.log(`${index + 1}. ${wallet}`);
  });

  const walletChoice = await ask('Choose wallet number (or press Enter for all): ');
  let selectedWallet = null;

  if (walletChoice.trim()) {
    const walletIndex = parseInt(walletChoice) - 1;
    if (walletIndex >= 0 && walletIndex < wallets.length) {
      selectedWallet = wallets[walletIndex];
    }
  }

  const stats = getStats(selectedWallet);

  if (!stats || (selectedWallet && !stats)) {
    console.log('❌ No active bot found for selected wallet.');
    return;
  }

  if (selectedWallet) {
    displayStats(selectedWallet, stats);
  } else {
    Object.entries(stats).forEach(([wallet, walletStats]) => {
      displayStats(wallet, walletStats);
      console.log('---');
    });
  }
}

function displayStats(walletAddress, stats) {
  console.log(`\n📊 Statistics for ${walletAddress}`);
  console.log(`Status: ${stats.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
  console.log(`Current Reserve: $${stats.currentReserve.toLocaleString()}`);
  console.log(`Reserve Goal: $${stats.reserveGoal.toLocaleString()}`);
  console.log(`Progress: ${stats.progressToGoal.toFixed(2)}%`);
  console.log(`Total Trades: ${stats.totalTrades}`);
  console.log(`Profitable Trades: ${stats.profitableTrades}`);
  console.log(`Win Rate: ${stats.winRate.toFixed(1)}%`);
  console.log(`Total Profit: $${stats.totalProfit.toFixed(2)}`);
  console.log(`Active Signals: ${stats.activeSignals}`);
  console.log(`Market Data Points: ${stats.marketDataPoints}`);
  console.log(`Learning Samples: ${stats.learningSamples}`);
}

async function listWalletsMenu() {
  console.log('\n📋 Configured Wallets');
  console.log('=====================');

  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log('❌ No wallets configured.');
    return;
  }

  wallets.forEach((wallet, index) => {
    console.log(`${index + 1}. ${wallet}`);
  });
}

async function emergencyStopMenu() {
  console.log('\n🚨 Emergency Stop');
  console.log('==================');

  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log('❌ No wallets configured.');
    return;
  }

  console.log('Available wallets:');
  wallets.forEach((wallet, index) => {
    console.log(`${index + 1}. ${wallet}`);
  });

  const walletChoice = await ask('Choose wallet number to EMERGENCY STOP: ');
  const walletIndex = parseInt(walletChoice) - 1;

  if (walletIndex < 0 || walletIndex >= wallets.length) {
    console.log('❌ Invalid wallet choice!');
    return;
  }

  const selectedWallet = wallets[walletIndex];
  const confirm = await ask(`⚠️ Are you sure you want to EMERGENCY STOP trading for ${selectedWallet}? (type 'YES' to confirm): `);

  if (confirm.toUpperCase() === 'YES') {
    await emergencyStop(selectedWallet);
    console.log('🚨 Emergency stop completed!');
  } else {
    console.log('❌ Emergency stop cancelled.');
  }
}

// Start the setup
console.log('🎯 Welcome to AwesomeSauceToken Advanced Trading Bot!');
console.log('🎯 This bot will help you build a $3M reserve through intelligent trading.');
console.log('🧠 Features: AI learning, web scraping, risk management, profit-only trades');
console.log('');

mainMenu();
