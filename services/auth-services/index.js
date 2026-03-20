import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { register, login } from './controllers/authControllers.js';
import { pgClient } from '../../packages/database/index.js';
import { KafkaUtil } from '../../packages/shared/kafka.js';

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

// 1. SECURITY & PARSING
app.use(helmet());
app.use(cors());
app.use(express.json());

// 2. ROUTES
app.post('/register', register);
app.post('/login', login);

// 3. BOOTSTRAP SEQUENCE
const startAuthService = async () => {
    try {
        console.log("🔐 Auth Service: Checking Connections...");

        // Ensure Postgres is alive
        await pgClient.$connect();
        console.log("✅ Auth Service: PostgreSQL Connected");

        // Verify Kafka is reachable by sending a system heartbeat
        await KafkaUtil.emit('system.heartbeat', { 
            service: 'auth-service', 
            status: 'ONLINE' 
        });

        app.listen(PORT, () => {
            console.log(`🚀 Auth Service Live at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Auth Service Boot Failed:", error.message);
        // Retry logic: if the DB isn't ready, wait 5s and try again
        setTimeout(startAuthService, 5000);
    }
};

startAuthService();