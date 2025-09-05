import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import compression from 'compression';
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
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Frontend is static bundle; can be hardened later with nonce hashes
}));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser
    if (cfg.allowAllCors || cfg.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'));
  },
  credentials: true
}));
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
