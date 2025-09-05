// Simplified monitoring service for production readiness
let apiRequestCount = 0;
let errorCount = 0;

export function incrementApiRequests() {
  apiRequestCount++;
}

export function incrementErrors() {
  errorCount++;
}

export function getSystemStatus() {
  return {
    status: 'healthy',
    uptime: process.uptime() * 1000,
    memoryUsage: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
    },
    requests: apiRequestCount,
    errors: errorCount,
    lastUpdated: new Date().toISOString()
  };
}

export function getPerformanceReport() {
  return {
    systemHealth: getSystemStatus(),
    performance: {
      totalApiRequests: apiRequestCount,
      errorRate: apiRequestCount > 0 ? (errorCount / apiRequestCount) : 0,
      uptime: process.uptime() * 1000
    }
  };
}

export function getAlerts() {
  return [];
}

export function resolveAlert(id: string) {
  return { resolved: true };
}