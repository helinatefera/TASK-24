export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/lenswork',
  jwtSecret: process.env.JWT_SECRET || '',
  masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY || '',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  rateLimitPerMin: parseInt(process.env.RATE_LIMIT_PER_MIN || '300', 10),
  reportsPerDay: parseInt(process.env.REPORTS_PER_DAY || '10', 10),
  idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS || '900000', 10),
  absoluteExpiryMs: parseInt(process.env.ABSOLUTE_EXPIRY_MS || '86400000', 10),
  nonceWindowMs: parseInt(process.env.NONCE_WINDOW_MS || '600000', 10),
  clockSkewMs: parseInt(process.env.CLOCK_SKEW_MS || '120000', 10),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export function validateConfig(): void {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  if (!config.masterEncryptionKey || config.masterEncryptionKey.length < 64) {
    throw new Error('MASTER_ENCRYPTION_KEY must be at least 64 hex characters');
  }
}
