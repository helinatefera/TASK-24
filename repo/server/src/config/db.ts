import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

export async function connectDB(): Promise<void> {
  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(config.mongoUri);
      logger.info('MongoDB connected successfully');
      return;
    } catch (err) {
      retries--;
      logger.warn(`MongoDB connection failed, retries left: ${retries}`);
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
