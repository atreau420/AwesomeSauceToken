// System monitoring and health check service
import { performHealthCheck, getAllBotMetrics, cleanupOldData } from './trading-service';
import { logger } from '../utils/logger';
import Database from 'better-sqlite3';

interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  bots: any;
  apiRequests: number;
  errors: number;
  lastUpdated: string;
}

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  resolved: boolean;
}

class SystemMonitor {
  private metrics: SystemMetrics;
  private alerts: Alert[] = [];
  private startTime: number;
  private apiRequestCount = 0;
  private errorCount = 0;
  private db: Database.Database;

  constructor() {
    this.startTime = Date.now();
    this.metrics = this.getInitialMetrics();
    
    // Initialize monitoring database
    const dbFile = process.env.MONITOR_DB_FILE || 'monitoring.db';
    this.db = new Database(dbFile);
    this.db.pragma('journal_mode = WAL');
    
    this.initializeDatabase();
    this.startPeriodicTasks();
  }

  private initializeDatabase() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS system_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      uptime INTEGER NOT NULL,
      memoryUsed REAL NOT NULL,
      memoryTotal REAL NOT NULL,
      activeBots INTEGER NOT NULL,
      apiRequests INTEGER NOT NULL,
      errors INTEGER NOT NULL
    );`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS system_alerts (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      resolved INTEGER DEFAULT 0
    );`);
  }

  private getInitialMetrics(): SystemMetrics {
    return {
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      bots: { total: 0, healthy: 0, stale: 0 },
      apiRequests: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  public updateMetrics() {
    try {
      this.metrics = {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
        bots: performHealthCheck(),
        apiRequests: this.apiRequestCount,
        errors: this.errorCount,
        lastUpdated: new Date().toISOString()
      };

      // Store metrics in database
      this.db.prepare(`INSERT INTO system_metrics 
        (timestamp, uptime, memoryUsed, memoryTotal, activeBots, apiRequests, errors) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(
          this.metrics.lastUpdated,
          this.metrics.uptime,
          this.metrics.memoryUsage.heapUsed,
          this.metrics.memoryUsage.heapTotal,
          this.metrics.bots.totalBots,
          this.metrics.apiRequests,
          this.metrics.errors
        );

      this.checkThresholds();
    } catch (error) {
      logger.error('Failed to update system metrics', { error: error.message });
    }
  }

  private checkThresholds() {
    const memoryUsagePercent = (this.metrics.memoryUsage.heapUsed / this.metrics.memoryUsage.heapTotal) * 100;
    
    // Memory usage alert
    if (memoryUsagePercent > 80) {
      this.addAlert('warning', `High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
    }

    // Stale bots alert
    if (this.metrics.bots.staleBot > 0) {
      this.addAlert('warning', `${this.metrics.bots.staleBot} bot(s) appear to be stale`);
    }

    // High error rate alert
    const errorRate = this.errorCount / Math.max(this.apiRequestCount, 1);
    if (errorRate > 0.05) { // 5% error rate
      this.addAlert('error', `High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    // Low trading activity alert
    if (this.metrics.bots.totalBots > 0 && this.metrics.bots.healthyBots === 0) {
      this.addAlert('error', 'No healthy trading bots are running');
    }
  }

  public addAlert(level: Alert['level'], message: string) {
    const alertId = Date.now().toString() + Math.random().toString(36).slice(2);
    const alert: Alert = {
      id: alertId,
      level,
      message,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alerts.unshift(alert);
    
    // Keep only last 100 alerts in memory
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    // Store alert in database
    this.db.prepare('INSERT INTO system_alerts (id, level, message, timestamp) VALUES (?, ?, ?, ?)')
      .run(alertId, level, message, alert.timestamp);

    logger.warn('System alert generated', alert);
  }

  public resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.db.prepare('UPDATE system_alerts SET resolved = 1 WHERE id = ?').run(alertId);
    }
  }

  public getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  public getAlerts(): Alert[] {
    return [...this.alerts];
  }

  public getUnresolvedAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  public incrementApiRequests() {
    if (!this.apiRequestCount) this.apiRequestCount = 0;
    this.apiRequestCount++;
  }

  public incrementErrors() {
    if (!this.errorCount) this.errorCount = 0;
    this.errorCount++;
  }

  public getHistoricalMetrics(hours = 24): any[] {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      return this.db.prepare(`
        SELECT * FROM system_metrics 
        WHERE timestamp > ? 
        ORDER BY timestamp DESC 
        LIMIT 288
      `).all(cutoffTime); // 288 = 24 hours * 12 (5-minute intervals)
    } catch (error) {
      logger.error('Failed to get historical metrics', { error: error.message });
      return [];
    }
  }

  public getSystemStatus() {
    const metrics = this.getMetrics();
    const alerts = this.getUnresolvedAlerts();
    
    let status = 'healthy';
    if (alerts.some(a => a.level === 'error')) {
      status = 'error';
    } else if (alerts.some(a => a.level === 'warning')) {
      status = 'warning';
    }

    return {
      status,
      uptime: metrics.uptime,
      memoryUsage: {
        used: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100)
      },
      bots: metrics.bots,
      alerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.level === 'error').length,
      lastUpdated: metrics.lastUpdated
    };
  }

  private startPeriodicTasks() {
    // Update metrics every 5 minutes
    setInterval(() => {
      this.updateMetrics();
    }, 5 * 60 * 1000);

    // Cleanup old data every hour
    setInterval(() => {
      cleanupOldData(7); // Keep 7 days of trading data
      this.cleanupOldMetrics(7); // Keep 7 days of system metrics
    }, 60 * 60 * 1000);

    // Initial update
    this.updateMetrics();
  }

  private cleanupOldMetrics(daysOld = 7) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      
      const deletedMetrics = this.db.prepare('DELETE FROM system_metrics WHERE timestamp < ?').run(cutoffDate);
      const deletedAlerts = this.db.prepare('DELETE FROM system_alerts WHERE timestamp < ? AND resolved = 1').run(cutoffDate);
      
      logger.info('Cleaned up old monitoring data', { 
        deletedMetrics: deletedMetrics.changes,
        deletedAlerts: deletedAlerts.changes 
      });
    } catch (error) {
      logger.error('Failed to cleanup old monitoring data', { error: error.message });
    }
  }

  public getPerformanceReport() {
    const metrics = this.getMetrics();
    const historicalData = this.getHistoricalMetrics(24);
    const botMetrics = getAllBotMetrics();
    
    // Calculate averages and trends
    const avgMemoryUsage = historicalData.length > 0 
      ? historicalData.reduce((sum, m) => sum + m.memoryUsed, 0) / historicalData.length
      : metrics.memoryUsage.heapUsed;

    const totalTrades = botMetrics.reduce((sum, bot) => sum + bot.tradesExecuted, 0);
    const totalProfit = botMetrics.reduce((sum, bot) => sum + bot.totalProfit, 0);

    return {
      systemHealth: this.getSystemStatus(),
      performance: {
        averageMemoryUsage: Math.round(avgMemoryUsage / 1024 / 1024), // MB
        totalApiRequests: this.apiRequestCount,
        errorRate: this.apiRequestCount > 0 ? (this.errorCount / this.apiRequestCount) : 0,
        uptime: metrics.uptime
      },
      trading: {
        activeBots: botMetrics.filter(b => b.running).length,
        totalTrades,
        totalProfit: totalProfit.toFixed(6),
        averageProfit: totalTrades > 0 ? (totalProfit / totalTrades).toFixed(6) : '0'
      },
      alerts: {
        total: this.alerts.length,
        unresolved: this.getUnresolvedAlerts().length,
        critical: this.alerts.filter(a => a.level === 'error' && !a.resolved).length
      }
    };
  }
}

// Singleton instance
export const systemMonitor = new SystemMonitor();

// Export functions for use in other modules
export const {
  getMetrics,
  getAlerts,
  getSystemStatus,
  addAlert,
  resolveAlert,
  incrementApiRequests,
  incrementErrors,
  getPerformanceReport
} = systemMonitor;