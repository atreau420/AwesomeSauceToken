export interface RuntimeConfig {
  port: number;
  corsOrigins: string[];
  version: string;
}

export function loadConfig(): RuntimeConfig {
  return {
    port: parseInt(process.env.PORT || '4000', 10),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()),
    version: process.env.APP_VERSION || '0.1.0'
  };
}
