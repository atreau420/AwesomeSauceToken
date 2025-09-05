import { EventEmitter } from 'events';
import { logger } from '../backend/utils/logger';
import fs from 'fs/promises';
import path from 'path';

interface SystemHealth {
  cpu: number;
  memory: number;
  diskSpace: number;
  networkLatency: number;
  errorRate: number;
  uptime: number;
}

interface MaintenanceAction {
  type: 'restart' | 'cleanup' | 'optimize' | 'alert' | 'scale';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  automated: boolean;
}

export { SystemHealth, MaintenanceAction };

export class MaintenanceAI extends EventEmitter {
  private isRunning = false;
  private healthHistory: SystemHealth[] = [];
  private maxHistorySize = 1000;
  private checkInterval = 30000; // 30 seconds
  private intervalId?: NodeJS.Timeout;
  private performanceBaseline: Partial<SystemHealth> = {};

  constructor() {
    super();
    this.loadBaseline();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Maintenance AI already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AI Continuous Maintenance System');

    // Start health monitoring
    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.checkInterval);

    // Emit startup event
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    await this.saveHealthHistory();
    logger.info('AI Continuous Maintenance System stopped');
    this.emit('stopped');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.collectHealthMetrics();
      this.healthHistory.push(health);

      // Maintain history size
      if (this.healthHistory.length > this.maxHistorySize) {
        this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
      }

      // Analyze health and determine actions
      const actions = await this.analyzeHealth(health);
      
      // Execute automated actions
      for (const action of actions.filter(a => a.automated)) {
        await this.executeMaintenanceAction(action);
      }

      // Emit alerts for manual actions
      for (const action of actions.filter(a => !a.automated)) {
        this.emit('maintenance-required', action);
      }

      this.emit('health-check', health);
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  private async collectHealthMetrics(): Promise<SystemHealth> {
    // Simulate system metrics collection
    // In a real implementation, this would collect actual system metrics
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      diskSpace: Math.random() * 100,
      networkLatency: Math.random() * 200 + 10,
      errorRate: Math.random() * 5,
      uptime: process.uptime()
    };
  }

  private async analyzeHealth(health: SystemHealth): Promise<MaintenanceAction[]> {
    const actions: MaintenanceAction[] = [];

    // CPU Analysis
    if (health.cpu > 90) {
      actions.push({
        type: 'optimize',
        priority: 'high',
        description: `High CPU usage detected: ${health.cpu.toFixed(1)}%`,
        automated: true
      });
    }

    // Memory Analysis
    if (health.memory > 85) {
      actions.push({
        type: 'cleanup',
        priority: health.memory > 95 ? 'critical' : 'high',
        description: `High memory usage: ${health.memory.toFixed(1)}%`,
        automated: health.memory > 95
      });
    }

    // Error Rate Analysis
    if (health.errorRate > 2) {
      actions.push({
        type: 'alert',
        priority: 'medium',
        description: `Elevated error rate: ${health.errorRate.toFixed(2)}%`,
        automated: false
      });
    }

    // Disk Space Analysis
    if (health.diskSpace > 80) {
      actions.push({
        type: 'cleanup',
        priority: health.diskSpace > 95 ? 'critical' : 'medium',
        description: `Low disk space: ${(100 - health.diskSpace).toFixed(1)}% remaining`,
        automated: true
      });
    }

    // Network Latency Analysis
    if (health.networkLatency > 100) {
      actions.push({
        type: 'optimize',
        priority: 'low',
        description: `High network latency: ${health.networkLatency.toFixed(1)}ms`,
        automated: false
      });
    }

    // Predictive maintenance using history
    if (this.healthHistory.length > 10) {
      const predictions = this.predictIssues();
      actions.push(...predictions);
    }

    return actions;
  }

  private predictIssues(): MaintenanceAction[] {
    const actions: MaintenanceAction[] = [];
    const recent = this.healthHistory.slice(-10);
    
    // Predict memory leaks
    const memoryTrend = this.calculateTrend(recent.map(h => h.memory));
    if (memoryTrend > 2) {
      actions.push({
        type: 'restart',
        priority: 'medium',
        description: 'Memory leak predicted based on usage trend',
        automated: true
      });
    }

    // Predict performance degradation
    const cpuTrend = this.calculateTrend(recent.map(h => h.cpu));
    if (cpuTrend > 5) {
      actions.push({
        type: 'optimize',
        priority: 'medium',
        description: 'Performance degradation predicted',
        automated: true
      });
    }

    return actions;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private async executeMaintenanceAction(action: MaintenanceAction): Promise<void> {
    logger.info(`Executing maintenance action: ${action.type} - ${action.description}`);

    try {
      switch (action.type) {
        case 'cleanup':
          await this.performCleanup();
          break;
        case 'optimize':
          await this.performOptimization();
          break;
        case 'restart':
          await this.performRestart();
          break;
        case 'alert':
          await this.sendAlert(action);
          break;
        default:
          logger.warn(`Unknown maintenance action type: ${action.type}`);
      }

      this.emit('maintenance-completed', action);
      logger.info(`Maintenance action completed: ${action.type}`);
    } catch (error) {
      logger.error(`Failed to execute maintenance action ${action.type}:`, error);
      this.emit('maintenance-failed', { action, error });
    }
  }

  private async performCleanup(): Promise<void> {
    // Clean up temporary files, logs, cache
    const tempDir = '/tmp';
    const logFiles = await this.getOldLogFiles();
    
    // Clean old log files (older than 7 days)
    for (const file of logFiles) {
      try {
        await fs.unlink(file);
        logger.debug(`Cleaned up log file: ${file}`);
      } catch (error) {
        logger.warn(`Failed to cleanup file ${file}:`, error);
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private async performOptimization(): Promise<void> {
    // Optimize system performance
    // This could include adjusting process priorities, cleaning caches, etc.
    logger.info('Performing system optimization');
    
    // Clear Node.js require cache for non-critical modules
    const keysToDelete = Object.keys(require.cache).filter(key => 
      key.includes('temp') || key.includes('cache')
    );
    
    keysToDelete.forEach(key => {
      try {
        delete require.cache[key];
      } catch (error) {
        // Ignore errors when clearing cache
      }
    });
  }

  private async performRestart(): Promise<void> {
    logger.warn('AI-initiated system restart requested');
    // In production, this would coordinate a graceful restart
    this.emit('restart-required');
  }

  private async sendAlert(action: MaintenanceAction): Promise<void> {
    logger.warn(`MAINTENANCE ALERT: ${action.description}`);
    this.emit('alert', action);
  }

  private async getOldLogFiles(): Promise<string[]> {
    try {
      const files: string[] = [];
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      
      // This is a simplified implementation
      // In production, scan actual log directories
      return files;
    } catch (error) {
      return [];
    }
  }

  private async loadBaseline(): Promise<void> {
    try {
      const baselinePath = path.join(process.cwd(), 'data', 'performance-baseline.json');
      const data = await fs.readFile(baselinePath, 'utf-8');
      this.performanceBaseline = JSON.parse(data);
      logger.info('Performance baseline loaded');
    } catch (error) {
      // Create default baseline
      this.performanceBaseline = {
        cpu: 30,
        memory: 50,
        diskSpace: 30,
        networkLatency: 50,
        errorRate: 0.5
      };
      logger.info('Using default performance baseline');
    }
  }

  private async saveHealthHistory(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const historyPath = path.join(dataDir, 'health-history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.healthHistory, null, 2));
      
      logger.info('Health history saved');
    } catch (error) {
      logger.error('Failed to save health history:', error);
    }
  }

  // Public methods for external access
  getHealthStatus(): SystemHealth | null {
    return this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1] : null;
  }

  getHealthHistory(): SystemHealth[] {
    return [...this.healthHistory];
  }

  isSystemHealthy(): boolean {
    const current = this.getHealthStatus();
    if (!current) return false;

    return current.cpu < 80 && 
           current.memory < 80 && 
           current.diskSpace < 80 && 
           current.errorRate < 2;
  }
}