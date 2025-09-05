export interface RuntimeConfig {
  port: number;
  corsOrigins: string[];
  version: string;
  allowAllCors: boolean;
}

export function loadConfig(): RuntimeConfig {
  return {
    port: parseInt(process.env.PORT || '4000', 10),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
    version: process.env.APP_VERSION || '0.1.0',
    allowAllCors: process.env.CORS_ALLOW_ALL === 'true'
  };
}
