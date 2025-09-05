#!/usr/bin/env node

import { Web3 } from 'web3';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Advanced Trading Bot Components...\n');

// Test 1: Web3 Connection
async function testWeb3Connection() {
  console.log('1️⃣ Testing Web3 Connection...');
  try {
    const web3 = new Web3(process.env.RPC_URL || 'https://polygon-rpc.com');
    const blockNumber = await web3.eth.getBlockNumber();
    console.log(`✅ Web3 Connected - Current Block: ${blockNumber}`);
    return true;
  } catch (error) {
    console.log(`❌ Web3 Connection Failed: ${error.message}`);
    return false;
  }
}

// Test 2: Web Scraping
async function testWebScraping() {
  console.log('\n2️⃣ Testing Web Scraping...');
  try {
    const response = await axios.get('https://coingecko.com', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const title = $('title').text();
    console.log(`✅ Web Scraping Works - Title: ${title}`);
    return true;
  } catch (error) {
    console.log(`❌ Web Scraping Failed: ${error.message}`);
    return false;
  }
}

// Test 3: Market Data API
async function testMarketData() {
  console.log('\n3️⃣ Testing Market Data API...');
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd', {
      timeout: 5000
    });

    const btcPrice = response.data.bitcoin.usd;
    const ethPrice = response.data.ethereum.usd;
    console.log(`✅ Market Data API Works - BTC: $${btcPrice}, ETH: $${ethPrice}`);
    return true;
  } catch (error) {
    console.log(`❌ Market Data API Failed: ${error.message}`);
    return false;
  }
}

// Test 4: File System Operations
async function testFileSystem() {
  console.log('\n4️⃣ Testing File System Operations...');
  try {
    const testData = { test: 'data', timestamp: new Date().toISOString() };
    const testPath = path.join(__dirname, 'test-data.json');

    fs.writeFileSync(testPath, JSON.stringify(testData, null, 2));
    const readData = JSON.parse(fs.readFileSync(testPath, 'utf8'));

    fs.unlinkSync(testPath);

    console.log(`✅ File System Works - Data: ${JSON.stringify(readData)}`);
    return true;
  } catch (error) {
    console.log(`❌ File System Failed: ${error.message}`);
    return false;
  }
}

// Test 5: Encryption/Decryption
async function testEncryption() {
  console.log('\n5️⃣ Testing Encryption/Decryption...');
  try {
    const crypto = await import('crypto');
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('test-password', 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update('test-private-key', 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    console.log(`✅ Encryption Works - Original: test-private-key, Decrypted: ${decrypted}`);
    return decrypted === 'test-private-key';
  } catch (error) {
    console.log(`❌ Encryption Failed: ${error.message}`);
    return false;
  }
}

// Test 6: Trading Bot Manager Import
async function testTradingBotManager() {
  console.log('\n6️⃣ Testing Trading Bot Manager Import...');
  try {
    const { setupWallet, listWallets } = await import('./dist/src/trading-bot-manager.js');
    console.log('✅ Trading Bot Manager Import Works');
    console.log(`📋 Available Wallets: ${listWallets().length}`);
    return true;
  } catch (error) {
    console.log(`❌ Trading Bot Manager Import Failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Advanced Trading Bot Component Tests');
  console.log('=======================================\n');

  const results = await Promise.all([
    testWeb3Connection(),
    testWebScraping(),
    testMarketData(),
    testFileSystem(),
    testEncryption(),
    testTradingBotManager()
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! Your trading bot is ready to build that $3M reserve!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Run: npm run trading-bot:setup');
    console.log('   2. Setup your wallet securely');
    console.log('   3. Start building your fortune!');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the errors above.');
  }
}

runAllTests().catch(console.error);
