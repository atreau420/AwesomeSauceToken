import AdvancedLearningTradingBot from './advanced-trading-bot.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WalletManager {
  private walletPath: string;
  private encryptedWallets: Map<string, any> = new Map();

  constructor() {
    this.walletPath = path.join(__dirname, '../secure-wallets.json');
    this.loadWallets();
  }

  private loadWallets() {
    try {
      if (fs.existsSync(this.walletPath)) {
        const encryptedData = JSON.parse(fs.readFileSync(this.walletPath, 'utf8'));
        this.encryptedWallets = new Map(Object.entries(encryptedData));
        console.log(`🔐 Loaded ${this.encryptedWallets.size} encrypted wallet(s)`);
      }
    } catch (error) {
      console.log('📝 No existing wallets found, starting fresh');
    }
  }

  private saveWallets() {
    try {
      const data = Object.fromEntries(this.encryptedWallets);
      fs.writeFileSync(this.walletPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Failed to save wallets:', error.message);
    }
  }

  async addWallet(walletAddress: string, privateKey: string, password: string) {
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(32);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const walletData = {
      address: walletAddress,
      encryptedKey: encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      created: new Date().toISOString()
    };

    this.encryptedWallets.set(walletAddress, walletData);
    this.saveWallets();

    console.log(`✅ Wallet ${walletAddress} securely stored`);
    return walletAddress;
  }

  async getWallet(walletAddress: string, password: string): Promise<string | null> {
    const walletData = this.encryptedWallets.get(walletAddress);
    if (!walletData) {
      console.error('❌ Wallet not found');
      return null;
    }

    try {
      const crypto = await import('crypto');
      const salt = Buffer.from(walletData.salt, 'hex');
      const key = crypto.scryptSync(password, salt, 32);
      const iv = Buffer.from(walletData.iv, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(walletData.encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('❌ Failed to decrypt wallet:', error.message);
      return null;
    }
  }

  listWallets() {
    return Array.from(this.encryptedWallets.keys());
  }

  removeWallet(walletAddress: string) {
    this.encryptedWallets.delete(walletAddress);
    this.saveWallets();
    console.log(`🗑️ Wallet ${walletAddress} removed`);
  }
}

class TradingBotManager {
  private walletManager: WalletManager;
  private activeBots: Map<string, AdvancedLearningTradingBot> = new Map();
  private botStats: Map<string, any> = new Map();

  constructor() {
    this.walletManager = new WalletManager();
  }

  async setupWallet(walletAddress: string, privateKey: string, password: string) {
    try {
      await this.walletManager.addWallet(walletAddress, privateKey, password);
      console.log('🎉 Wallet setup complete!');
      console.log('💡 You can now start the trading bot with: startBot(walletAddress, password)');
      return true;
    } catch (error) {
      console.error('❌ Wallet setup failed:', error.message);
      return false;
    }
  }

  async startBot(walletAddress: string, password: string) {
    try {
      if (this.activeBots.has(walletAddress)) {
        console.log('🤖 Bot already running for this wallet');
        return false;
      }

      const privateKey = await this.walletManager.getWallet(walletAddress, password);
      if (!privateKey) {
        console.error('❌ Failed to decrypt wallet - check password');
        return false;
      }

      console.log('🚀 Starting Advanced Learning Trading Bot...');
      console.log('🎯 Target: $3M Reserve');
      console.log('🧠 Features: Web scraping, AI learning, Risk management');
      console.log('💰 Only profitable trades (including gas fees)');

      const bot = new AdvancedLearningTradingBot(walletAddress, privateKey);
      await bot.start();

      this.activeBots.set(walletAddress, bot);

      // Start monitoring
      this.monitorBot(walletAddress);

      console.log('✅ Trading bot started successfully!');
      console.log('📊 Use getStats() to monitor performance');
      console.log('🛑 Use stopBot() to stop trading');

      return true;
    } catch (error) {
      console.error('❌ Failed to start trading bot:', error.message);
      return false;
    }
  }

  async stopBot(walletAddress: string) {
    const bot = this.activeBots.get(walletAddress);
    if (bot) {
      await bot.stop();
      this.activeBots.delete(walletAddress);
      console.log('🛑 Trading bot stopped');
      return true;
    } else {
      console.log('❌ No active bot found for this wallet');
      return false;
    }
  }

  private async monitorBot(walletAddress: string) {
    const bot = this.activeBots.get(walletAddress);
    if (!bot) return;

    const monitor = async () => {
      try {
        const stats = bot.getStats();
        this.botStats.set(walletAddress, stats);

        // Log progress every 5 minutes
        if (stats.totalTrades > 0 && stats.totalTrades % 10 === 0) {
          console.log(`📊 Bot Progress Update:`);
          console.log(`   Reserve: $${stats.currentReserve.toLocaleString()}`);
          console.log(`   Progress: ${stats.progressToGoal.toFixed(2)}%`);
          console.log(`   Trades: ${stats.totalTrades} (${stats.winRate.toFixed(1)}% win rate)`);
          console.log(`   Total Profit: $${stats.totalProfit.toFixed(2)}`);
        }

        // Check if goal achieved
        if (stats.currentReserve >= stats.reserveGoal) {
          console.log('🎉 CONGRATULATIONS! $3M Reserve Goal Achieved!');
          console.log('🏆 Trading bot will stop automatically');
          await this.stopBot(walletAddress);
          return;
        }

        // Continue monitoring if bot is still active
        if (this.activeBots.has(walletAddress)) {
          setTimeout(monitor, 300000); // Check every 5 minutes
        }
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }
    };

    // Start monitoring after 30 seconds
    setTimeout(monitor, 30000);
  }

  getStats(walletAddress?: string) {
    if (walletAddress) {
      const bot = this.activeBots.get(walletAddress);
      return bot ? bot.getStats() : null;
    }

    // Return stats for all bots
    const allStats = {};
    for (const [address, bot] of this.activeBots) {
      allStats[address] = bot.getStats();
    }
    return allStats;
  }

  getRecentTrades(walletAddress: string, limit: number = 5): any[] {
    const bot = this.activeBots.get(walletAddress) as any;
    return bot && typeof bot.getRecentTrades === 'function' ? bot.getRecentTrades(limit) : [];
  }

  getSignals(walletAddress: string, symbol?: string): any[] {
    const bot = this.activeBots.get(walletAddress) as any;
    return bot && typeof bot.getSignals === 'function' ? bot.getSignals(symbol) : [];
  }

  listActiveBots() {
    return Array.from(this.activeBots.keys());
  }

  listWallets() {
    return this.walletManager.listWallets();
  }

  async emergencyStop(walletAddress: string) {
    console.log('🚨 EMERGENCY STOP ACTIVATED');
    await this.stopBot(walletAddress);
    console.log('🛑 All trading activities halted');
  }
}

// Global instance
const tradingBotManager = new TradingBotManager();

// Export functions for easy use
export const setupWallet = (walletAddress: string, privateKey: string, password: string) =>
  tradingBotManager.setupWallet(walletAddress, privateKey, password);

export const startBot = (walletAddress: string, password: string) =>
  tradingBotManager.startBot(walletAddress, password);

export const stopBot = (walletAddress: string) =>
  tradingBotManager.stopBot(walletAddress);

export const getStats = (walletAddress?: string) =>
  tradingBotManager.getStats(walletAddress);

export const getRecentTrades = (walletAddress: string, limit?: number): any[] =>
  tradingBotManager.getRecentTrades(walletAddress, limit);

export const getSignals = (walletAddress: string, symbol?: string): any[] =>
  tradingBotManager.getSignals(walletAddress, symbol);

export const listActiveBots = () =>
  tradingBotManager.listActiveBots();

export const listWallets = () =>
  tradingBotManager.listWallets();

export const emergencyStop = (walletAddress: string) =>
  tradingBotManager.emergencyStop(walletAddress);

export default TradingBotManager;
