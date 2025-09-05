import { Router } from 'express';
import { getAllBotMetrics } from '../services/trading-service';
import { getSystemStatus, getPerformanceReport, getAlerts, resolveAlert } from '../services/monitoring-service-simple';

const startedAt = Date.now();
const r = Router();

// Legacy system info endpoint
r.get('/info', (_req, res) => {
  res.json({
    uptimeSec: (Date.now() - startedAt) / 1000,
    memory: process.memoryUsage(),
    pid: process.pid,
    node: process.version
  });
});

// System health endpoint
r.get('/health', (_req, res) => {
  try {
    const status = getSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: 'Failed to get system status',
      message: error.message 
    });
  }
});

// Detailed performance report
r.get('/performance', (_req, res) => {
  try {
    const report = getPerformanceReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get performance report' });
  }
});

// System alerts
r.get('/alerts', (_req, res) => {
  try {
    const alerts = getAlerts();
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Resolve an alert
r.post('/alerts/:alertId/resolve', (req, res) => {
  try {
    resolveAlert(req.params.alertId);
    res.json({ resolved: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// All bot metrics
r.get('/bots', (_req, res) => {
  try {
    const metrics = getAllBotMetrics();
    res.json({ bots: metrics });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bot metrics' });
  }
});

export default r;
