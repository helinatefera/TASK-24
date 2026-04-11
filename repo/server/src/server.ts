import { config, validateConfig } from './config';
import { connectDB } from './config/db';
import { logger } from './utils/logger';
import { loadSensitiveWords } from './middleware/contentFilter';
import { startScheduler } from './jobs/scheduler';
import app from './app';
import fs from 'fs';
import path from 'path';

async function startServer(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Ensure upload directories exist
    const uploadDirs = [
      'portfolios', 'verification-docs', 'settlement-attachments',
      'report-evidence', 'deliverables', 'exports'
    ];
    for (const dir of uploadDirs) {
      const dirPath = path.join(config.uploadDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
    logger.info('Upload directories verified');

    // Connect to MongoDB
    await connectDB();

    // Load sensitive words
    try {
      await loadSensitiveWords();
      logger.info('Sensitive words loaded');
    } catch (err) {
      logger.warn('Failed to load sensitive words, continuing without filter');
    }

    // Start background job scheduler
    startScheduler();
    logger.info('Background job scheduler started');

    // Start HTTP server
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

startServer();
