import { execSync } from 'child_process';
import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from './logger';

/**
 * Resolves standard seedlist replicaSet URI if Node's internal c-ares DNS resolver
 * fails to resolve SRV records due to local UDP 53 filtering / Windows loopback issues.
 */
const resolveDirectMongoUri = (srvUri: string): string | null => {
  try {
    const urlMatch = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)\/?([^?]*)\??(.*)/);
    if (!urlMatch) return null;

    const [, username, password, host, database, query] = urlMatch;
    const srvTarget = `_mongodb._tcp.${host}`;

    const output = execSync(`nslookup -type=SRV ${srvTarget}`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const matches = [...output.matchAll(/svr hostname\s*=\s*([^\s\r\n]+)/gi)].map((m) => m[1]);
    if (!matches || matches.length === 0) return null;

    const seedlist = matches.map((shard) => `${shard}:27017`).join(',');
    const params = new URLSearchParams(query);
    if (!params.has('ssl')) params.set('ssl', 'true');
    if (!params.has('authSource')) params.set('authSource', 'admin');

    const directUri = `mongodb://${username}:${password}@${seedlist}/${database || 'b_map_db'}?${params.toString()}`;
    return directUri;
  } catch (err: any) {
    logger.debug(`Dynamic system SRV lookup failed: ${err.message}`);
    return null;
  }
};

let hasRegisteredConnectionListeners = false;

const registerConnectionListeners = (): void => {
  if (hasRegisteredConnectionListeners) return;
  hasRegisteredConnectionListeners = true;

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected.');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });
};

export const connectDatabase = async (): Promise<void> => {
  mongoose.set('strictQuery', true);

  const connectOptions = {
    autoIndex: true, // Automatically build 2dsphere and unique indexes
    serverSelectionTimeoutMS: 5000,
  };

  try {
    // 1. Attempt standard system DNS connection first
    await mongoose.connect(env.MONGODB_URI, connectOptions);
    registerConnectionListeners();
    logger.info(`✅ Connected to MongoDB geospatial database at: ${env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@')}`);
    return;
  } catch (error: any) {
    const isSrvError =
      error?.message?.includes('querySrv') ||
      error?.message?.includes('ECONNREFUSED') ||
      error?.message?.includes('ENOTFOUND') ||
      error?.name === 'MongoServerSelectionError' ||
      error?.name === 'MongooseServerSelectionError';

    if (isSrvError) {
      // 2. Attempt Dynamic System SRV Seedlist Fallback
      if (env.MONGODB_URI.startsWith('mongodb+srv://')) {
        logger.info('🔄 Attempting OS-level SRV seedlist resolution to bypass UDP 53 filtering...');
        const directUri = resolveDirectMongoUri(env.MONGODB_URI);
        if (directUri) {
          try {
            await mongoose.connect(directUri, connectOptions);
            registerConnectionListeners();
            logger.info('✅ Connected to MongoDB Atlas cluster via OS-resolved seedlist replica set');
            return;
          } catch (directError) {
            logger.warn(`Seedlist direct connection attempt failed: ${directError}`);
          }
        }
      }

      // 3. Fallback DNS attempt
      try {
        logger.info('🔄 Retrying MongoDB connection with fallback DNS servers (8.8.8.8, 1.1.1.1)...');
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await mongoose.connect(env.MONGODB_URI, connectOptions);
        registerConnectionListeners();
        logger.info(`✅ Connected to MongoDB geospatial database via DNS fallback`);
        return;
      } catch (fallbackError) {
        logger.error('❌ Fallback DNS connection attempt also failed:', fallbackError);
      }
    }

    registerConnectionListeners();
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
