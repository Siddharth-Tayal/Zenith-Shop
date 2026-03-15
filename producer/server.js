const express = require('express');
const kafka = require('../shared/kafka-client');
const redisClient = require("../shared/redis-client")
const app = express();
app.use(express.json());

const producer = kafka.producer();

async function start() {
    await redisClient.connect()
    await producer.connect();
    console.log("⚡ Gateway Ready");
}
async function start() {
    try {
        await redisClient.connect();
        await producer.connect();
        // Seed stock for testing
        await redisClient.set('stock:laptop', 10);
        console.log("✅ API Gateway: Redis & Kafka Connected");
    } catch (err) {
        console.error("❌ Startup Error:", err);
    }
}

app.post('/api/checkout', async (req, res) => {
    const { userId, productId, qty } = req.body;

    // 1. CACHING LAYER (Industry standard: Check Redis first)
    const stock = await redisClient.get(`stock:${productId}`);
    if (!stock || parseInt(stock) < qty) {
        return res.status(400).json({ status: "REJECTED", message: "Insufficient stock in cache" });
    }

    // 2. ATOMIC UPDATE (Deduct from Redis so other users can't buy it)
    await redisClient.decrBy(`stock:${productId}`, qty);

    // 3. KAFKA WRITE (The "Direct Operation" is NOT on the Real DB)
    // We send an event. This is the hand-off.
    await producer.send({
        topic: 'order-lifecycle',
        messages: [{
            value: JSON.stringify({
                userId,
                productId,
                qty,
                action: 'CREATE_ORDER',
                timestamp: Date.now()
            })
        }]
    });

    // 4. IMMEDIATE RESPONSE (User doesn't wait for MongoDB)
    res.status(202).json({ 
        status: "ACCEPTED", 
        message: "Order queued. Stock reserved in Redis." 
    });
});

start();
app.listen(3000, () => console.log("🚀 Server running on port 3000"));