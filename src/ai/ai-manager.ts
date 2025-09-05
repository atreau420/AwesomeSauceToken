import { EventEmitter } from 'events';
import { logger } from '../backend/utils/logger';
import { MaintenanceAI } from './maintenance-ai';
import { TreasuryAI } from './treasury-ai';
import { EnhancementAI } from './enhancement-ai';

interface AISystemStatus {
  maintenance: {
    running: boolean;
    healthy: boolean;
    lastCheck: Date | null;
    actionsToday: number;
  };
  treasury: {
    running: boolean;
    totalValue: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    strategy: string;
    lastRebalance: Date | null;
  };
  enhancement: {
    running: boolean;
    activeTests: number;
    completedEnhancements: number;
    pendingRecommendations: number;
  };
}

interface AIInsight {
  type: 'maintenance' | 'treasury' | 'enhancement' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionRequired: boolean;
  timestamp: Date;
  metadata?: any;
}

interface AIRecommendation {
  system: 'maintenance' | 'treasury' | 'enhancement';
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: string;
  description: string;
  automated: boolean;
}

export { AISystemStatus, AIInsight, AIRecommendation };

export class AIManager extends EventEmitter {
  private maintenanceAI: MaintenanceAI;
  private treasuryAI: TreasuryAI;
  private enhancementAI: EnhancementAI;
  private isRunning = false;
  private insights: AIInsight[] = [];
  private maxInsights = 1000;
  private systemStatus: AISystemStatus = {
    maintenance: { running: false, healthy: true, lastCheck: null, actionsToday: 0 },
    treasury: { running: false, totalValue: 0, riskLevel: 'low', strategy: 'moderate', lastRebalance: null },
    enhancement: { running: false, activeTests: 0, completedEnhancements: 0, pendingRecommendations: 0 }
  };

  constructor() {
    super();
    
    // Initialize AI systems
    this.maintenanceAI = new MaintenanceAI();
    this.treasuryAI = new TreasuryAI();
    this.enhancementAI = new EnhancementAI();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AI Manager already running');
      return;
    }

    logger.info('Starting AI Manager and all AI systems');
    this.isRunning = true;

    try {
      // Start all AI systems
      await Promise.all([
        this.maintenanceAI.start(),
        this.treasuryAI.start(),
        this.enhancementAI.start()
      ]);

      // Update system status
      this.updateSystemStatus();
      
      // Start periodic status updates
      setInterval(() => {
        this.updateSystemStatus();
        this.performCrossSystemAnalysis();
      }, 60000); // Every minute

      this.addInsight({
        type: 'system',
        priority: 'medium',
        title: 'AI Manager Started',
        description: 'All AI systems are now active and monitoring for continuous maintenance, treasury management, and enhancement opportunities.',
        actionRequired: false,
        timestamp: new Date()
      });

      this.emit('started');
      logger.info('AI Manager fully operational');

    } catch (error) {
      logger.error('Failed to start AI Manager:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping AI Manager and all AI systems');
    this.isRunning = false;

    try {
      await Promise.all([
        this.maintenanceAI.stop(),
        this.treasuryAI.stop(),
        this.enhancementAI.stop()
      ]);

      this.addInsight({
        type: 'system',
        priority: 'low',
        title: 'AI Manager Stopped',
        description: 'All AI systems have been gracefully shut down.',
        actionRequired: false,
        timestamp: new Date()
      });

      this.emit('stopped');
      logger.info('AI Manager stopped');

    } catch (error) {
      logger.error('Error stopping AI Manager:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Maintenance AI Events
    this.maintenanceAI.on('started', () => {
      this.systemStatus.maintenance.running = true;
      this.addInsight({
        type: 'maintenance',
        priority: 'low',
        title: 'Maintenance AI Started',
        description: 'Continuous maintenance monitoring is now active.',
        actionRequired: false,
        timestamp: new Date()
      });
    });

    this.maintenanceAI.on('maintenance-required', (action) => {
      this.systemStatus.maintenance.actionsToday++;
      this.addInsight({
        type: 'maintenance',
        priority: action.priority as any,
        title: 'Maintenance Required',
        description: action.description,
        actionRequired: !action.automated,
        timestamp: new Date(),
        metadata: action
      });
    });

    this.maintenanceAI.on('health-check', (health) => {
      this.systemStatus.maintenance.lastCheck = new Date();
      this.systemStatus.maintenance.healthy = health.cpu < 80 && health.memory < 80 && health.errorRate < 2;
    });

    // Treasury AI Events
    this.treasuryAI.on('started', () => {
      this.systemStatus.treasury.running = true;
      this.addInsight({
        type: 'treasury',
        priority: 'low',
        title: 'Treasury AI Started',
        description: 'Intelligent treasury management and risk monitoring is now active.',
        actionRequired: false,
        timestamp: new Date()
      });
    });

    this.treasuryAI.on('portfolio-update', (portfolio) => {
      this.systemStatus.treasury.totalValue = portfolio.totalValue;
      this.systemStatus.treasury.strategy = portfolio.currentStrategy;
      
      // Determine risk level
      if (portfolio.riskMetrics.maxDrawdown > 0.15) {
        this.systemStatus.treasury.riskLevel = 'critical';
      } else if (portfolio.riskMetrics.volatility > 0.6) {
        this.systemStatus.treasury.riskLevel = 'high';
      } else if (portfolio.riskMetrics.volatility > 0.3) {
        this.systemStatus.treasury.riskLevel = 'medium';
      } else {
        this.systemStatus.treasury.riskLevel = 'low';
      }
    });

    this.treasuryAI.on('treasury-recommendation', (action) => {
      this.addInsight({
        type: 'treasury',
        priority: action.urgency as any,
        title: `Treasury Action: ${action.type}`,
        description: `${action.reason} - Amount: $${action.amount.toFixed(2)}`,
        actionRequired: true,
        timestamp: new Date(),
        metadata: action
      });
    });

    this.treasuryAI.on('strategy-change', (change) => {
      this.addInsight({
        type: 'treasury',
        priority: 'medium',
        title: 'Strategy Change Recommended',
        description: `Switch from ${change.from} to ${change.to}: ${change.reason}`,
        actionRequired: true,
        timestamp: new Date(),
        metadata: change
      });
    });

    // Enhancement AI Events
    this.enhancementAI.on('started', () => {
      this.systemStatus.enhancement.running = true;
      this.addInsight({
        type: 'enhancement',
        priority: 'low',
        title: 'Enhancement AI Started',
        description: 'Website and game optimization AI is now analyzing user behavior and performance.',
        actionRequired: false,
        timestamp: new Date()
      });
    });

    this.enhancementAI.on('enhancement-recommended', (enhancement) => {
      this.systemStatus.enhancement.pendingRecommendations++;
      this.addInsight({
        type: 'enhancement',
        priority: enhancement.priority as any,
        title: `${enhancement.type.toUpperCase()} Enhancement`,
        description: enhancement.description,
        actionRequired: !enhancement.automated,
        timestamp: new Date(),
        metadata: enhancement
      });
    });

    this.enhancementAI.on('enhancement-implemented', (enhancement) => {
      this.systemStatus.enhancement.completedEnhancements++;
      this.systemStatus.enhancement.pendingRecommendations = Math.max(0, this.systemStatus.enhancement.pendingRecommendations - 1);
      this.addInsight({
        type: 'enhancement',
        priority: 'low',
        title: 'Enhancement Implemented',
        description: `Automated implementation: ${enhancement.description}`,
        actionRequired: false,
        timestamp: new Date(),
        metadata: enhancement
      });
    });

    this.enhancementAI.on('ab-test-completed', (test) => {
      this.addInsight({
        type: 'enhancement',
        priority: 'medium',
        title: 'A/B Test Completed',
        description: `${test.name} completed with ${test.results?.confidence}% confidence. Winner: Variant ${test.results?.winner}`,
        actionRequired: true,
        timestamp: new Date(),
        metadata: test
      });
    });

    this.enhancementAI.on('analysis-complete', (analysis) => {
      this.systemStatus.enhancement.activeTests = analysis.activeTests;
    });
  }

  private updateSystemStatus(): void {
    // Get current status from each AI system
    const maintenanceHealth = this.maintenanceAI.getHealthStatus();
    const portfolioStatus = this.treasuryAI.getPortfolioStatus();
    const enhancementStats = this.enhancementAI.getUserBehaviorStats();

    // Update maintenance status
    if (maintenanceHealth) {
      this.systemStatus.maintenance.healthy = this.maintenanceAI.isSystemHealthy();
      this.systemStatus.maintenance.lastCheck = new Date();
    }

    // Update treasury status
    this.systemStatus.treasury.totalValue = portfolioStatus.totalValue;
    this.systemStatus.treasury.strategy = portfolioStatus.currentStrategy;

    // Emit status update
    this.emit('status-updated', this.systemStatus);
  }

  private performCrossSystemAnalysis(): void {
    // Analyze relationships between different AI systems
    
    // Treasury-Maintenance correlation
    if (this.systemStatus.treasury.riskLevel === 'high' && !this.systemStatus.maintenance.healthy) {
      this.addInsight({
        type: 'system',
        priority: 'high',
        title: 'System-Wide Risk Alert',
        description: 'Both treasury risk and system health issues detected. Consider immediate attention.',
        actionRequired: true,
        timestamp: new Date(),
        metadata: {
          treasuryRisk: this.systemStatus.treasury.riskLevel,
          systemHealth: this.systemStatus.maintenance.healthy
        }
      });
    }

    // Performance-Enhancement correlation
    const performanceStats = this.enhancementAI.getPerformanceStats();
    const avgLoadTime = Object.values(performanceStats.averageLoadTime).reduce((sum, time) => sum + time, 0) / Object.keys(performanceStats.averageLoadTime).length;
    
    if (avgLoadTime > 3000 && this.systemStatus.enhancement.pendingRecommendations > 5) {
      this.addInsight({
        type: 'system',
        priority: 'medium',
        title: 'Performance-Enhancement Sync Needed',
        description: `Slow average load time (${(avgLoadTime/1000).toFixed(1)}s) with ${this.systemStatus.enhancement.pendingRecommendations} pending optimizations.`,
        actionRequired: true,
        timestamp: new Date()
      });
    }

    // Resource usage correlation
    const maintenanceHealth = this.maintenanceAI.getHealthStatus();
    if (maintenanceHealth && maintenanceHealth.cpu > 90 && this.systemStatus.treasury.totalValue > 0) {
      this.addInsight({
        type: 'system',
        priority: 'high',
        title: 'Resource Constraint Risk',
        description: 'High CPU usage may affect trading performance. Consider scaling or optimization.',
        actionRequired: true,
        timestamp: new Date()
      });
    }
  }

  private addInsight(insight: AIInsight): void {
    this.insights.push(insight);
    
    // Maintain insights history
    if (this.insights.length > this.maxInsights) {
      this.insights = this.insights.slice(-this.maxInsights);
    }

    // Emit insight
    this.emit('insight', insight);

    // Log critical insights
    if (insight.priority === 'critical') {
      logger.warn(`CRITICAL AI INSIGHT: ${insight.title} - ${insight.description}`);
    } else if (insight.priority === 'high') {
      logger.info(`HIGH PRIORITY AI INSIGHT: ${insight.title} - ${insight.description}`);
    }
  }

  // Public API methods
  getSystemStatus(): AISystemStatus {
    return { ...this.systemStatus };
  }

  getRecentInsights(limit: number = 50): AIInsight[] {
    return this.insights.slice(-limit);
  }

  getCriticalInsights(): AIInsight[] {
    return this.insights.filter(insight => insight.priority === 'critical' || insight.priority === 'high');
  }

  getInsightsByType(type: AIInsight['type']): AIInsight[] {
    return this.insights.filter(insight => insight.type === type);
  }

  getRecommendations(): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    
    // Get actionable insights and convert to recommendations
    const actionableInsights = this.insights.filter(insight => insight.actionRequired);
    
    for (const insight of actionableInsights.slice(-20)) { // Last 20 actionable insights
      recommendations.push({
        system: insight.type as any,
        action: insight.title,
        priority: insight.priority,
        estimatedImpact: this.getEstimatedImpact(insight),
        description: insight.description,
        automated: false // Most actionable insights require manual intervention
      });
    }

    return recommendations;
  }

  private getEstimatedImpact(insight: AIInsight): string {
    switch (insight.priority) {
      case 'critical': return 'High Impact';
      case 'high': return 'Medium-High Impact';
      case 'medium': return 'Medium Impact';
      case 'low': return 'Low Impact';
      default: return 'Unknown Impact';
    }
  }

  // Control methods for individual AI systems
  async restartMaintenanceAI(): Promise<void> {
    logger.info('Restarting Maintenance AI');
    await this.maintenanceAI.stop();
    await this.maintenanceAI.start();
  }

  async restartTreasuryAI(): Promise<void> {
    logger.info('Restarting Treasury AI');
    await this.treasuryAI.stop();
    await this.treasuryAI.start();
  }

  async restartEnhancementAI(): Promise<void> {
    logger.info('Restarting Enhancement AI');
    await this.enhancementAI.stop();
    await this.enhancementAI.start();
  }

  setTreasuryStrategy(strategy: 'conservative' | 'moderate' | 'aggressive' | 'emergency'): void {
    this.treasuryAI.setStrategy(strategy);
    this.addInsight({
      type: 'treasury',
      priority: 'medium',
      title: 'Strategy Updated',
      description: `Treasury strategy manually set to: ${strategy}`,
      actionRequired: false,
      timestamp: new Date()
    });
  }

  startABTest(testConfig: any): string {
    const testId = this.enhancementAI.startABTest(testConfig);
    this.addInsight({
      type: 'enhancement',
      priority: 'low',
      title: 'A/B Test Started',
      description: `New A/B test started: ${testConfig.name}`,
      actionRequired: false,
      timestamp: new Date()
    });
    return testId;
  }

  getDetailedStatus() {
    return {
      overview: this.systemStatus,
      maintenance: {
        status: this.maintenanceAI.getHealthStatus(),
        history: this.maintenanceAI.getHealthHistory().slice(-20)
      },
      treasury: {
        status: this.treasuryAI.getPortfolioStatus(),
        riskMetrics: this.treasuryAI.getRiskMetrics(),
        allocation: this.treasuryAI.getCurrentAllocation()
      },
      enhancement: {
        userBehavior: this.enhancementAI.getUserBehaviorStats(),
        performance: this.enhancementAI.getPerformanceStats(),
        activeTests: this.enhancementAI.getActiveTests(),
        history: this.enhancementAI.getEnhancementHistory().slice(-10)
      },
      insights: this.getRecentInsights(20),
      recommendations: this.getRecommendations()
    };
  }
}