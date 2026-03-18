import { PrismaClient as PostgresClient } from './postgres/generated/client/index.js';
import { PrismaClient as MongoClient } from './mongodb/generated/client/index.js';

// Initialize the clients
// We use a singleton pattern here so multiple imports don't create multiple connections
export const pgClient = new PostgresClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL,
    },
  },
});

export const mgClient = new MongoClient({
  datasources: {
    db: {
      url: process.env.MONGODB_URL,
    },
  },
});

/**
 * Utility to connect all databases at once.
 * Useful for the API Gateway or worker startup.
 */
export const connectAllDbs = async () => {
  try {
    await pgClient.$connect();
    console.log("✅ PostgreSQL Connection Established");
    
    await mgClient.$connect();
    console.log("✅ MongoDB Connection Established");
  } catch (error) {
    console.error("❌ Database Connection Error:", error);
    process.exit(1); 
  }
};