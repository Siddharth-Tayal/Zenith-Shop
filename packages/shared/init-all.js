import { pgClient, mgClient } from '../database/index.js'; // Your Prisma clients
import { KafkaUtil } from './kafka.js';

export const initializeInfrastructure = async () => {
    console.log("🔍 Checking Infrastructure Availability...");

    try {
        // 1. Check Postgres
        await pgClient.$connect();
        console.log("✅ PostgreSQL: Connected");

        // 2. Check MongoDB
        await mgClient.$connect();
        console.log("✅ MongoDB: Connected");

        // 3. Check Kafka (Try to emit a system-start event)
        await KafkaUtil.emit('system.init', { status: 'GATEWAY_STARTING' });
        console.log("✅ Kafka: Connected & Event Emitted");

        return true;
    } catch (error) {
        console.error("❌ Infrastructure Boot Error:", error.message);
        return false;
    }
};