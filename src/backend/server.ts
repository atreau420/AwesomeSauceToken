import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { errorHandler, notFoundHandler } from './utils/errors';
import { logger } from './utils/logger';
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
app.use(helmet());
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

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(cfg.port, () => {
  logger.info('Backend listening', { port: cfg.port });
});

export default app;
