import { mgClient } from '../../../packages/database/index.js';
import { RedisUtil } from '../../../packages/shared/redis.js';
import { KafkaUtil } from '../../../packages/shared/kafka.js';

export const createProduct = async (req, res) => {
    const { id, name, description, price, stock, category, attributes, tags } = req.body;
    console.warn("Id : ",id)

    try {
        // 1. DATABASE WRITE (Using your specific schema)
        const newProduct = await mgClient.product.create({
            data: {
                id,
                name,
                description,
                price: parseFloat(price),
                stock: parseInt(stock),
                category,
                attributes: attributes || {}, // Maps to your Json? field
                tags: Array.isArray(tags) ? tags : [], // Maps to your String[] field
            }
        });

        // 2. CACHE WARM-UP
        // We store the full product in Redis so the GET /:id is instant
        await RedisUtil.setCache(`prod:${id}`, newProduct, 3600);
        
        // 3. EVENT EMISSION
        KafkaUtil.emit('product.events', {
            type: 'PRODUCT_CREATED',
            payload: newProduct
        }).catch(err => console.error("Kafka Broadcast Failed:", err));

        res.status(201).json({
            message: "Product created successfully",
            data: newProduct,
            source: 'database' 
        });

    } catch (error) {
        console.error("Create Product Error:", error);
        res.status(400).json({ error: "Creation failed. Ensure ID is unique and fields match schema." });
    }
};

export const getProductDetails = async (req, res) => {
    const { id } = req.params;
    const cacheKey = `prod:${id}`;

    try {
        // 1. Check Redis
        const cached = await RedisUtil.getCache(cacheKey);
        console.log(cacheKey , "cached key")
        if (cached) return res.json({ ...cached, source: 'redis' });

        console.log("unchaned")
        // 2. Fallback to MongoDB
        const product = await mgClient.product.findUnique({ where: { id } });
        
        if (!product) return res.status(404).json({ error: "Product not found" });

        // 3. Update Cache
        await RedisUtil.setCache(cacheKey, product, 3600);

        res.json({ ...product, source: 'mongodb' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const updated = await mgClient.product.update({
            where: { id },
            data: req.body
        });

        // 4. INVALIDATE CACHE: If product changes, delete the old Redis key
        await RedisUtil.delCache(`prod:${id}`); 

        // 5. ASYNC SYNC: Tell Kafka so the Search Service can update its index
        KafkaUtil.emit('product.updates', { type: 'PRODUCT_UPDATED', id, data: updated });

        res.json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};