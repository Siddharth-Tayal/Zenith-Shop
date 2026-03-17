import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RedisUtil } from '../../packages/shared/redis.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. SECURITY MIDDLEWARE
app.use(helmet()); // Protects headers
app.use(cors());   // Handles Cross-Origin
app.use(express.json());

// 2. RATE LIMITING (Using our Redis Utility)

app.use('/' , async (req, res, next) => {
    const ip = req.ip;
    const requests = await RedisUtil.increment(`rate-limit:${ip}`);
    
    if (requests === 1) {
        await RedisUtil.setCache(`rate-limit:${ip}`, 1, 60); // 60s window
    }

    if (requests > 100) {
        return res.status(429).json({ error: "Too many requests. Slow down!" });
    }
    return res.status(200).json({
        message : `rate-limit:${ip} , requests : ${requests}`
    })
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
        pathRewrite: { [`^${path}`]: '' }, // Strips /api/auth before sending to service
    }));
}

app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
});