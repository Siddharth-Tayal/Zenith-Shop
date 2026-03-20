import 'dotenv/config'; // Essential for process.env.JWT_SECRET
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken'; // Missing this will crash the token check!
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RedisUtil } from '../../packages/shared/redis.js';
import { initializeInfrastructure } from '../../packages/shared/init-all.js';

const app = express();
const PORT = process.env.PORT || 5000;

// 1. SECURITY & CONFIG
app.use(helmet());
app.use(cors());

// Note: express.json() is REMOVED from here to allow 
// raw proxying of POST/PUT bodies to microservices.

// 2. RATE LIMITING
app.use(async (req, res, next) => {
    try {
        const ip = req.ip;
        const requests = await RedisUtil.increment(`rate-limit:${ip}`);
        
        if (requests === 1) {
            await RedisUtil.setCache(`rate-limit:${ip}`, 1, 60); 
        }

        if (requests > 100) {
            return res.status(429).json({ error: "Too many requests. Slow down!" });
        }
        next(); 
    } catch (err) {
        console.error("Rate limit error:", err);
        next(); 
    }
});

// 3. AUTHENTICATION (REDIS-FIRST)
app.use(async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fast-lookup in Redis session store
        const session = await RedisUtil.getCache(`session:${decoded.id}`);
        
        if (!session) {
            return res.status(401).json({ error: "Session expired or invalid" });
        }

        req.user = decoded; 
        next();
    } catch (err) {
        // If token is invalid, we don't crash, we just don't attach req.user
        next(); 
    }
});

// 4. PROXY ROUTES
const routes = {
    '/api/auth': 'http://localhost:3001',
    '/api/products': 'http://localhost:3002',
    '/api/orders': 'http://localhost:3003',
};

for (const [path, target] of Object.entries(routes)) {
    app.use(path, createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { [`^${path}`]: '' },
        onError: (err, req, res) => {
            console.error(`❌ Proxy Error to ${target}:`, err.message);
            res.status(504).json({ error: "Service Unreachable" });
        }
    }));
}

// 5. SERVER START LOGIC
const startServer = async () => {
    const isReady = await initializeInfrastructure();

    if (!isReady) {
        console.log("⚠️ Infrastructure not ready. Retrying in 5 seconds...");
        setTimeout(startServer, 5000); // Fixed: Use 5000ms, not PORT
        return;
    }

    app.listen(PORT, () => {
        console.log(`🚀 API Gateway Live at http://localhost:${PORT}`);
    });
};

startServer();