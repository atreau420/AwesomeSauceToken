// Simple structured logger wrapper (can be upgraded to pino later)
import util from 'util';

interface LogMeta { [k: string]: any }

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Level[] = ['debug','info','warn','error'];
const currentLevel = process.env.LOG_LEVEL || 'info';
const levelIdx = LEVELS.indexOf(currentLevel as Level);

function log(level: Level, msg: string, meta?: LogMeta) {
  if (LEVELS.indexOf(level) < levelIdx) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg,
    ...meta
  };
  // Avoid huge objects
  console.log(JSON.stringify(line));
}

export const logger = {
  debug: (m: string, meta?: LogMeta) => log('debug', m, meta),
  info: (m: string, meta?: LogMeta) => log('info', m, meta),
  warn: (m: string, meta?: LogMeta) => log('warn', m, meta),
  error: (m: string, meta?: LogMeta) => log('error', m, meta)
};
