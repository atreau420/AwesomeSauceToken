import 'dotenv/config';
import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFoundHandler } from './utils/errors';
import { logger } from './utils/logger';
import { tickAgents, getAgentSnapshot } from './ai/agent-runner';
import swaggerUi from 'swagger-ui-express';
import { WebSocketServer } from 'ws';
import routes from './routes';
import { requestId } from './utils/request-id';
import { loadConfig } from './utils/runtime-config';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cfg = loadConfig();

// Enhanced security middleware for production
app.use(requestId());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Rate limiting for production
if (process.env.RATE_LIMIT_ENABLED === 'true') {
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' }
  });

  const purchaseLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Purchase rate limit exceeded, please try again later.' }
  });

  app.use(generalLimiter);
  app.use('/api/auth', authLimiter);
  app.use('/api/marketplace/purchase', purchaseLimiter);
}

app.use(cors({ 
  origin: process.env.ALLOWED_ORIGINS?.split(',') || cfg.corsOrigins, 
  credentials: true 
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health endpoints
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(), 
    version: cfg.version,
    environment: process.env.NODE_ENV 
  });
});

app.get('/readyz', (_req, res) => {
  // Add actual health checks here in production
  const ready = true;
  if (!ready) return res.status(503).json({ ready: false });
  res.json({ ready: true });
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Static frontend
app.use(express.static(path.join(__dirname, '../../public')));

// API Documentation
const openApiDoc = { 
  openapi: '3.0.0', 
  info: { 
    title: 'AwesomeSauce Marketplace API', 
    version: cfg.version,
    description: 'Secure marketplace and trading bot API'
  }, 
  paths: { 
    '/api/marketplace/listings': { 
      get: { 
        summary: 'Get active marketplace listings', 
        responses: { '200': { description: 'List of active listings' } } 
      } 
    },
    '/api/auth/nonce': {
      post: {
        summary: 'Request authentication nonce',
        responses: { '200': { description: 'Nonce for wallet signature' } }
      }
    }
  } 
};
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

// Main routes
app.use('/api', routes);

// AI Agent status endpoint
app.get('/api/ai/status', (_req, res) => {
  const snapshot = getAgentSnapshot();
  res.json({ ai: snapshot, timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Server startup
const port = parseInt(process.env.PORT || '5000');
const host = process.env.HOST || '0.0.0.0';

// HTTPS setup for production
if (process.env.HTTPS_ENABLED === 'true' && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  try {
    const httpsOptions = {
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
      key: fs.readFileSync(process.env.SSL_KEY_PATH)
    };

    const server = https.createServer(httpsOptions, app);
    
    server.listen(port, host, () => {
      logger.info('HTTPS Server listening', { port, host, env: process.env.NODE_ENV });
    });

    // WebSocket for real-time updates
    if (cfg.wsPort) {
      const wss = new WebSocketServer({ server });
      wss.on('connection', (ws) => {
        logger.info('WebSocket connection established');
        ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
      });
    }

    // Start AI agents
    if (process.env.NODE_ENV === 'production') {
      tickAgents();
    }

  } catch (error) {
    logger.error('HTTPS setup failed:', error);
    process.exit(1);
  }
} else {
  // HTTP fallback for development
  const server = app.listen(port, host, () => {
    logger.info('HTTP Server listening', { port, host, env: process.env.NODE_ENV });
  });

  // WebSocket for development
  if (cfg.wsPort) {
    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
      logger.info('WebSocket connection established');
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
    });
  }

  // Start AI agents in development
  if (process.env.NODE_ENV !== 'test') {
    tickAgents();
  }
}

export default app;