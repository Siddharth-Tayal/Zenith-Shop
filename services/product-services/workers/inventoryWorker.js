import { KafkaUtil } from '../../../packages/shared/kafka.js';
import { mgClient } from '../../../packages/database/index.js';
import { RedisUtil } from '../../../packages/shared/redis.js';

export const startInventorySync = async () => {
    try {
        console.log("🛠️  Inventory Worker: Starting Kafka Listener...");

        // Listen for ORDER_PLACED events to update MongoDB stock
        await KafkaUtil.listen('inventory-sync-group', 'order.events', async (event) => {
            const { productId, quantity } = event.payload;

            if (event.type === 'ORDER_PLACED') {
                console.log(`[Worker] Processing stock deduction for ${productId}...`);

                // 1. Update MongoDB (The permanent record)
                await mgClient.product.update({
                    where: { id: productId },
                    data: { 
                        stock: { decrement: quantity },
                        totalSold: { increment: quantity }
                    }
                });

                // 2. Clear Redis Product Cache
                // This ensures the next GET request shows the updated stock
                await RedisUtil.setCache(`prod:${productId}`, null, 0);

                console.log(`✅ [Worker] Inventory synced for ${productId}`);
            }
        });

    } catch (error) {
        console.error("❌ Inventory Worker Error:", error.message);
        // We don't exit(1) here so the main API can still serve reads 
        // even if the background sync blips
    }
};