import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AIManager } from '../../ai/ai-manager';

const router = Router();

// Global AI Manager instance
let aiManager: AIManager | null = null;

// Initialize AI Manager
const initializeAI = async (): Promise<AIManager> => {
  if (!aiManager) {
    aiManager = new AIManager();
    await aiManager.start();
    
    // Set up event listeners for real-time updates
    aiManager.on('insight', (insight) => {
      logger.info(`AI Insight: ${insight.title} - ${insight.description}`);
    });
    
    aiManager.on('status-updated', (status) => {
      logger.debug('AI system status updated');
    });
  }
  return aiManager;
};

// GET /api/ai/status - Get overall AI system status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const status = manager.getSystemStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get AI status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI system status',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ai/insights - Get recent AI insights
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string;
    
    let insights;
    if (type) {
      insights = manager.getInsightsByType(type as any);
    } else {
      insights = manager.getRecentInsights(limit);
    }
    
    res.json({
      success: true,
      data: insights,
      count: insights.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get AI insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI insights',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ai/insights/critical - Get critical insights only
router.get('/insights/critical', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const insights = manager.getCriticalInsights();
    
    res.json({
      success: true,
      data: insights,
      count: insights.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get critical AI insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get critical AI insights',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ai/recommendations - Get AI recommendations
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const recommendations = manager.getRecommendations();
    
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get AI recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI recommendations',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ai/detailed - Get detailed status of all AI systems
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const detailed = manager.getDetailedStatus();
    
    res.json({
      success: true,
      data: detailed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get detailed AI status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get detailed AI status',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ai/treasury/strategy - Set treasury strategy
router.post('/treasury/strategy', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const { strategy } = req.body;
    
    if (!['conservative', 'moderate', 'aggressive', 'emergency'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy. Must be one of: conservative, moderate, aggressive, emergency',
        timestamp: new Date().toISOString()
      });
    }
    
    manager.setTreasuryStrategy(strategy);
    
    res.json({
      success: true,
      message: `Treasury strategy set to: ${strategy}`,
      data: { strategy },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to set treasury strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set treasury strategy',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ai/abtest - Start a new A/B test
router.post('/abtest', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const testConfig = req.body;
    
    // Validate test config
    if (!testConfig.name || !testConfig.metric) {
      return res.status(400).json({
        success: false,
        error: 'Test name and metric are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const testId = manager.startABTest(testConfig);
    
    res.json({
      success: true,
      message: 'A/B test started successfully',
      data: { testId, config: testConfig },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to start A/B test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start A/B test',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ai/restart/:system - Restart individual AI system
router.post('/restart/:system', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const { system } = req.params;
    
    switch (system) {
      case 'maintenance':
        await manager.restartMaintenanceAI();
        break;
      case 'treasury':
        await manager.restartTreasuryAI();
        break;
      case 'enhancement':
        await manager.restartEnhancementAI();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid system. Must be one of: maintenance, treasury, enhancement',
          timestamp: new Date().toISOString()
        });
    }
    
    res.json({
      success: true,
      message: `${system} AI system restarted successfully`,
      data: { system },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to restart ${req.params.system} AI:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to restart ${req.params.system} AI system`,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ai/start - Start AI Manager
router.post('/start', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    
    res.json({
      success: true,
      message: 'AI Manager started successfully',
      data: manager.getSystemStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to start AI Manager:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start AI Manager',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ai/stop - Stop AI Manager
router.post('/stop', async (req: Request, res: Response) => {
  try {
    if (aiManager) {
      await aiManager.stop();
      aiManager = null;
    }
    
    res.json({
      success: true,
      message: 'AI Manager stopped successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to stop AI Manager:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop AI Manager',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ai/health - Health check for AI systems
router.get('/health', async (req: Request, res: Response) => {
  try {
    const manager = await initializeAI();
    const status = manager.getSystemStatus();
    
    const healthy = status.maintenance.running && 
                   status.treasury.running && 
                   status.enhancement.running &&
                   status.maintenance.healthy;
    
    res.status(healthy ? 200 : 503).json({
      success: true,
      healthy,
      data: {
        maintenance: { running: status.maintenance.running, healthy: status.maintenance.healthy },
        treasury: { running: status.treasury.running, riskLevel: status.treasury.riskLevel },
        enhancement: { running: status.enhancement.running, activeTests: status.enhancement.activeTests }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AI health check failed:', error);
    res.status(503).json({
      success: false,
      healthy: false,
      error: 'AI health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;