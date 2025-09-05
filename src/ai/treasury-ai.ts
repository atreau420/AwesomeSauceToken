import { EventEmitter } from 'events';
import { logger } from '../backend/utils/logger';
import fs from 'fs/promises';
import path from 'path';

interface TreasuryBalance {
  asset: string;
  balance: number;
  usdValue: number;
  allocation: number; // percentage of total portfolio
}

interface RiskMetrics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  var95: number; // Value at Risk 95%
  beta: number;
}

interface AllocationStrategy {
  conservative: { [asset: string]: number };
  moderate: { [asset: string]: number };
  aggressive: { [asset: string]: number };
  emergency: { [asset: string]: number };
}

interface TreasuryAction {
  type: 'rebalance' | 'hedge' | 'liquidate' | 'acquire' | 'emergency';
  asset: string;
  amount: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: number;
}

interface MarketCondition {
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  liquidity: 'low' | 'medium' | 'high';
  sentiment: number; // -1 to 1
}

export { TreasuryBalance, RiskMetrics, AllocationStrategy, TreasuryAction, MarketCondition };

export class TreasuryAI extends EventEmitter {
  private isRunning = false;
  private balances: TreasuryBalance[] = [];
  private riskMetrics: RiskMetrics = {
    volatility: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    var95: 0,
    beta: 1
  };
  private totalValue = 0;
  private targetAllocations: AllocationStrategy = {
    conservative: { MATIC: 60, USDC: 30, WETH: 10 },
    moderate: { MATIC: 40, USDC: 40, WETH: 20 },
    aggressive: { MATIC: 30, USDC: 20, WETH: 50 },
    emergency: { MATIC: 10, USDC: 80, WETH: 10 }
  };
  private currentStrategy: keyof AllocationStrategy = 'moderate';
  private checkInterval = 60000; // 1 minute
  private intervalId?: NodeJS.Timeout;
  private priceHistory: { [asset: string]: number[] } = {};
  private emergencyThreshold = 0.15; // 15% portfolio loss triggers emergency mode

  constructor() {
    super();
    this.loadConfiguration();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Treasury AI already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AI Treasury Management System');

    // Initial portfolio assessment
    await this.performTreasuryAnalysis();

    // Start periodic monitoring
    this.intervalId = setInterval(async () => {
      await this.performTreasuryAnalysis();
    }, this.checkInterval);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    await this.saveTreasuryData();
    logger.info('AI Treasury Management System stopped');
    this.emit('stopped');
  }

  private async performTreasuryAnalysis(): Promise<void> {
    try {
      // Update balances and prices
      await this.updateBalances();
      await this.updatePriceHistory();
      
      // Calculate risk metrics
      this.calculateRiskMetrics();
      
      // Analyze market conditions
      const marketCondition = await this.analyzeMarketConditions();
      
      // Determine optimal strategy
      const recommendedStrategy = this.determineOptimalStrategy(marketCondition);
      
      // Check if strategy change is needed
      if (recommendedStrategy !== this.currentStrategy) {
        logger.info(`Strategy change recommended: ${this.currentStrategy} -> ${recommendedStrategy}`);
        this.emit('strategy-change', {
          from: this.currentStrategy,
          to: recommendedStrategy,
          reason: this.getStrategyChangeReason(marketCondition)
        });
      }

      // Generate rebalancing actions
      const actions = await this.generateTreasuryActions();
      
      // Execute high-priority automated actions
      for (const action of actions.filter(a => a.urgency === 'critical')) {
        await this.executeTreasuryAction(action);
      }

      // Emit recommendations for other actions
      for (const action of actions.filter(a => a.urgency !== 'critical')) {
        this.emit('treasury-recommendation', action);
      }

      // Emit portfolio status
      this.emit('portfolio-update', {
        totalValue: this.totalValue,
        balances: this.balances,
        riskMetrics: this.riskMetrics,
        strategy: this.currentStrategy,
        marketCondition
      });

    } catch (error) {
      logger.error('Treasury analysis failed:', error);
    }
  }

  private async updateBalances(): Promise<void> {
    // Simulate balance updates - in production, this would fetch real balances
    this.balances = [
      {
        asset: 'MATIC',
        balance: Math.random() * 10000,
        usdValue: Math.random() * 5000,
        allocation: 0
      },
      {
        asset: 'USDC',
        balance: Math.random() * 5000,
        usdValue: Math.random() * 5000,
        allocation: 0
      },
      {
        asset: 'WETH',
        balance: Math.random() * 5,
        usdValue: Math.random() * 10000,
        allocation: 0
      }
    ];

    this.totalValue = this.balances.reduce((sum, balance) => sum + balance.usdValue, 0);
    
    // Calculate allocations
    this.balances.forEach(balance => {
      balance.allocation = (balance.usdValue / this.totalValue) * 100;
    });
  }

  private async updatePriceHistory(): Promise<void> {
    // Simulate price updates - in production, fetch real prices
    const assets = ['MATIC', 'USDC', 'WETH'];
    
    for (const asset of assets) {
      if (!this.priceHistory[asset]) {
        this.priceHistory[asset] = [];
      }
      
      const lastPrice = this.priceHistory[asset].length > 0 
        ? this.priceHistory[asset][this.priceHistory[asset].length - 1]
        : 1;
      
      // Add some random price movement
      const change = (Math.random() - 0.5) * 0.1; // ±5% random movement
      const newPrice = lastPrice * (1 + change);
      
      this.priceHistory[asset].push(newPrice);
      
      // Keep only last 100 prices
      if (this.priceHistory[asset].length > 100) {
        this.priceHistory[asset] = this.priceHistory[asset].slice(-100);
      }
    }
  }

  private calculateRiskMetrics(): void {
    // Calculate volatility from price history
    const maticPrices = this.priceHistory['MATIC'] || [];
    if (maticPrices.length > 1) {
      const returns = [];
      for (let i = 1; i < maticPrices.length; i++) {
        returns.push((maticPrices[i] - maticPrices[i-1]) / maticPrices[i-1]);
      }
      
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      this.riskMetrics.volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized volatility
      
      // Calculate Sharpe Ratio (assuming risk-free rate of 3%)
      const riskFreeRate = 0.03;
      this.riskMetrics.sharpeRatio = (avgReturn * 365 - riskFreeRate) / this.riskMetrics.volatility;
      
      // Calculate max drawdown
      let peak = maticPrices[0];
      let maxDrawdown = 0;
      for (const price of maticPrices) {
        if (price > peak) peak = price;
        const drawdown = (peak - price) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      this.riskMetrics.maxDrawdown = maxDrawdown;
      
      // Calculate VaR (95% confidence)
      const sortedReturns = [...returns].sort((a, b) => a - b);
      const varIndex = Math.floor(sortedReturns.length * 0.05);
      this.riskMetrics.var95 = sortedReturns[varIndex] * this.totalValue;
    }
  }

  private async analyzeMarketConditions(): Promise<MarketCondition> {
    // Analyze market conditions based on price history and volatility
    const volatility = this.riskMetrics.volatility;
    const recentPrices = this.priceHistory['MATIC']?.slice(-20) || [];
    
    let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    if (recentPrices.length > 1) {
      const firstPrice = recentPrices[0];
      const lastPrice = recentPrices[recentPrices.length - 1];
      const change = (lastPrice - firstPrice) / firstPrice;
      
      if (change > 0.05) trend = 'bullish';
      else if (change < -0.05) trend = 'bearish';
    }

    const volatilityLevel: 'low' | 'medium' | 'high' = 
      volatility < 0.3 ? 'low' : volatility < 0.6 ? 'medium' : 'high';

    // Simulate sentiment score
    const sentiment = Math.random() * 2 - 1; // -1 to 1

    return {
      trend,
      volatility: volatilityLevel,
      liquidity: 'medium', // Simplified
      sentiment
    };
  }

  private determineOptimalStrategy(market: MarketCondition): keyof AllocationStrategy {
    // Check for emergency conditions first
    if (this.riskMetrics.maxDrawdown > this.emergencyThreshold) {
      return 'emergency';
    }

    // Strategy selection based on market conditions
    if (market.volatility === 'high' || market.sentiment < -0.5) {
      return 'conservative';
    } else if (market.trend === 'bullish' && market.sentiment > 0.5) {
      return 'aggressive';
    } else {
      return 'moderate';
    }
  }

  private getStrategyChangeReason(market: MarketCondition): string {
    if (this.riskMetrics.maxDrawdown > this.emergencyThreshold) {
      return 'Emergency mode: High portfolio losses detected';
    }
    
    return `Market conditions: ${market.trend} trend, ${market.volatility} volatility, sentiment: ${market.sentiment.toFixed(2)}`;
  }

  private async generateTreasuryActions(): Promise<TreasuryAction[]> {
    const actions: TreasuryAction[] = [];
    const targetAllocation = this.targetAllocations[this.currentStrategy];

    // Check for rebalancing needs
    for (const balance of this.balances) {
      const targetPercent = targetAllocation[balance.asset] || 0;
      const currentPercent = balance.allocation;
      const difference = Math.abs(currentPercent - targetPercent);

      // Rebalance if allocation is off by more than 5%
      if (difference > 5) {
        const targetValue = (targetPercent / 100) * this.totalValue;
        const rebalanceAmount = targetValue - balance.usdValue;

        actions.push({
          type: rebalanceAmount > 0 ? 'acquire' : 'liquidate',
          asset: balance.asset,
          amount: Math.abs(rebalanceAmount),
          reason: `Rebalancing: Current ${currentPercent.toFixed(1)}%, Target ${targetPercent}%`,
          urgency: difference > 15 ? 'high' : difference > 10 ? 'medium' : 'low',
          estimatedImpact: difference * 0.01 // Simplified impact calculation
        });
      }
    }

    // Emergency liquidation if needed
    if (this.riskMetrics.maxDrawdown > this.emergencyThreshold) {
      const riskiest = this.balances.reduce((a, b) => 
        a.allocation > b.allocation ? a : b
      );
      
      actions.push({
        type: 'emergency',
        asset: riskiest.asset,
        amount: riskiest.usdValue * 0.5, // Liquidate 50% of riskiest position
        reason: `Emergency liquidation: Max drawdown ${(this.riskMetrics.maxDrawdown * 100).toFixed(1)}%`,
        urgency: 'critical',
        estimatedImpact: this.riskMetrics.maxDrawdown
      });
    }

    return actions;
  }

  private async executeTreasuryAction(action: TreasuryAction): Promise<void> {
    logger.info(`Executing treasury action: ${action.type} ${action.amount} ${action.asset} - ${action.reason}`);

    try {
      // Simulate action execution
      switch (action.type) {
        case 'emergency':
          await this.performEmergencyAction(action);
          break;
        case 'rebalance':
        case 'acquire':
        case 'liquidate':
          await this.performTradeAction(action);
          break;
        case 'hedge':
          await this.performHedgeAction(action);
          break;
        default:
          logger.warn(`Unknown treasury action type: ${action.type}`);
      }

      this.emit('treasury-action-completed', action);
      logger.info(`Treasury action completed: ${action.type}`);
    } catch (error) {
      logger.error(`Failed to execute treasury action ${action.type}:`, error);
      this.emit('treasury-action-failed', { action, error });
    }
  }

  private async performEmergencyAction(action: TreasuryAction): Promise<void> {
    logger.warn(`EMERGENCY TREASURY ACTION: ${action.reason}`);
    // In production, this would execute emergency liquidation
    // For now, just update the current strategy to emergency mode
    this.currentStrategy = 'emergency';
  }

  private async performTradeAction(action: TreasuryAction): Promise<void> {
    // Simulate trade execution
    logger.info(`Simulating ${action.type} of ${action.amount} USD worth of ${action.asset}`);
    // In production, this would interface with exchanges or DEXs
  }

  private async performHedgeAction(action: TreasuryAction): Promise<void> {
    // Implement hedging strategies (derivatives, correlations, etc.)
    logger.info(`Implementing hedge for ${action.asset}: ${action.reason}`);
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'data', 'treasury-config.json');
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      
      if (config.targetAllocations) {
        this.targetAllocations = { ...this.targetAllocations, ...config.targetAllocations };
      }
      
      if (config.emergencyThreshold) {
        this.emergencyThreshold = config.emergencyThreshold;
      }
      
      logger.info('Treasury configuration loaded');
    } catch (error) {
      logger.info('Using default treasury configuration');
    }
  }

  private async saveTreasuryData(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const treasuryData = {
        balances: this.balances,
        riskMetrics: this.riskMetrics,
        totalValue: this.totalValue,
        currentStrategy: this.currentStrategy,
        priceHistory: this.priceHistory,
        lastUpdate: new Date().toISOString()
      };
      
      const dataPath = path.join(dataDir, 'treasury-data.json');
      await fs.writeFile(dataPath, JSON.stringify(treasuryData, null, 2));
      
      logger.info('Treasury data saved');
    } catch (error) {
      logger.error('Failed to save treasury data:', error);
    }
  }

  // Public methods for external access
  getPortfolioStatus() {
    return {
      totalValue: this.totalValue,
      balances: this.balances,
      riskMetrics: this.riskMetrics,
      currentStrategy: this.currentStrategy
    };
  }

  getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  getCurrentAllocation(): { [asset: string]: number } {
    const allocation: { [asset: string]: number } = {};
    this.balances.forEach(balance => {
      allocation[balance.asset] = balance.allocation;
    });
    return allocation;
  }

  setStrategy(strategy: keyof AllocationStrategy): void {
    if (this.targetAllocations[strategy]) {
      this.currentStrategy = strategy;
      logger.info(`Treasury strategy changed to: ${strategy}`);
      this.emit('strategy-updated', strategy);
    } else {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
  }

  isEmergencyMode(): boolean {
    return this.currentStrategy === 'emergency';
  }
}