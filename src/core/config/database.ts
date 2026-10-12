import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from './logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    // Configure reliable DNS servers to resolve MongoDB Atlas SRV records (querySrv ECONNREFUSED fix)
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
    } catch {
      // Ignore if environment prevents custom DNS servers
    }

    mongoose.set('strictQuery', true);

    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true, // Automatically build 2dsphere and unique indexes
      serverSelectionTimeoutMS: 5000,
    });

    logger.info(`✅ Connected to MongoDB geospatial database at: ${env.MONGODB_URI}`);
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('⚠️ Running in development mode without active MongoDB. Geospatial database operations will throw until MongoDB is available.');
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed.');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected.');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});
