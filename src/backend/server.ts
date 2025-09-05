import 'dotenv/config';
import express from 'express';
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

// Core middleware
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
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // More restrictive for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const purchaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 purchases per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Purchase rate limit exceeded, please try again later.' }
});

app.use(generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/marketplace/purchase', purchaseLimiter);

app.use(cors({ origin: cfg.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('dev'));

// Health & meta
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: cfg.version });
});

let ready = true; // Could extend with dependency checks later
app.get('/readyz', (_req, res) => {
  if (!ready) return res.status(503).json({ ready: false });
  res.json({ ready: true });
});
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Static frontend
app.use(express.static(path.join(__dirname, '../../public')));

// Simple OpenAPI stub
const openApiDoc = { openapi: '3.0.0', info: { title: 'AwesomeSauce API', version: cfg.version }, paths: { '/api/ai/status': { get: { summary: 'AI status', responses: { '200': { description: 'OK' } } } } } };
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

app.use('/api', routes);

// AI agent snapshot endpoint
app.get('/api/ai/status', (_req, res) => {
  res.json({ agents: getAgentSnapshot() });
});

// Basic in-process scheduler
const wsPort = Number(process.env.WS_PORT || 0);
let wss: WebSocketServer | undefined;
if (wsPort > 0) {
  wss = new WebSocketServer({ port: wsPort });
  logger.info('WebSocket server started', { wsPort });
}

setInterval(() => {
  tickAgents();
  const snapshot = getAgentSnapshot();
  if (wss && snapshot.length) {
    const payload = JSON.stringify({ type: 'agentUpdate', data: snapshot });
    wss.clients.forEach(c => { try { c.send(payload); } catch {} });
  }
}, 60 * 1000); // scheduler cadence

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(cfg.port, () => {
  logger.info('Backend listening', { port: cfg.port });
});

export default app;
