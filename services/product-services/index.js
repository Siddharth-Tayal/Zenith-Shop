import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pgClient, mgClient } from '../../packages/database/index.js';
import { RedisUtil } from '../../packages/shared/redis.js';
import { startInventorySync } from './workers/inventoryWorker.js';
import { getProductDetails, updateProduct , createProduct } from './controllers/productControllers.js';

const app = express();
const PORT = process.env.PRODUCT_SERVICE_PORT || 3002;

// 1. MIDDLEWARE
app.use(helmet());
app.use(cors());
app.use(express.json());

// 2. ROUTES
// will protect it for admin access
app.post('/', createProduct);          // CREATE: POST http://localhost:5000/api/products
// Public Read (Uses Redis Cache-Aside)
app.get('/:id', getProductDetails);

// Protected Write (Direct DB + Kafka Emit)
app.put('/:id', updateProduct);

// 3. INITIALIZATION BOOTSTRAP
const bootstrap = async () => {
    try {
        console.log("📦 Product Service: Connecting to Infrastructure...");
        
        // Ensure DBs are ready
        await pgClient.$connect();
        await mgClient.$connect();
        
        // Start the Kafka Consumer Worker
        // This listens for 'ORDER_PLACED' events to update MongoDB stock
        await startInventorySync();
        
        app.listen(PORT, () => {
            console.log(`✅ Product Service Live on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Product Service Boot Error:", error);
        process.exit(1);
    }
};

bootstrap();