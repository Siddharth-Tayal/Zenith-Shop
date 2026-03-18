import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RedisUtil } from '../../packages/shared/redis.js';
import { initializeInfrastructure } from '../../packages/shared/init-all.js';
const app = express();
const PORT = process.env.PORT || 5000;

// 1. SECURITY MIDDLEWARE
app.use(helmet()); // Protects headers
app.use(cors());   // Handles Cross-Origin
// app.use(express.json());
const startServer = async () => {
    const isReady = await initializeInfrastructure();

    if (!isReady) {
        console.log("⚠️ Infrastructure not ready. Retrying in 5 seconds...");
        setTimeout(startServer, PORT);
        return;
    }

    app.listen(PORT, () => {
        console.log(`🚀 API Gateway Live at http://localhost:${PORT}`);
    });
};
// 2. RATE LIMITING MIDDLEWARE
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
        
        // IMPORTANT: Move to the next middleware (the proxies)
        next(); 
    } catch (err) {
        console.error("Rate limit error:", err);
        next(); // Fail-open so users can still browse if Redis blips
    }
});
app.use(async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    console.log(token , "token")
    if (!token) return next(); // Public routes

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // CHECK REDIS INSTEAD OF DB
        const session = await RedisUtil.getCache(`session:${decoded.id}`);
        
        if (!session) {
            return res.status(401).json({ error: "Session expired or invalid" });
        }

        req.user = decoded; // Attach user to request
        next();
    } catch (err) {
        next(); 
    }
});
// 3. ROUTE INITIALIZATION (Proxying)
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
        // No complex 'onProxyReq' needed anymore! 
        // The data flows through naturally because we didn't 'eat' it with express.json()
        onError: (err, req, res) => {
            console.error(`❌ Proxy Error to ${target}:`, err.message);
            res.status(504).json({ error: "Service Unreachable" });
        }
    }));
}

startServer()