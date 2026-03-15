const mongoose = require('mongoose');
const kafka = require('../shared/kafka-client');

// Connect to MongoDB (The "Real" DB)
mongoose.connect('mongodb://localhost:27017/zenith_shop');
const Order = mongoose.model('Order', {
    userId: String,
    productId: String,
    qty: Number,
    status: String,
    createdAt: { type: Date, default: Date.now }
});

const consumer = kafka.consumer({ groupId: 'order-processing-group' });

async function runWorker() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'order-lifecycle', fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const event = JSON.parse(message.value.toString());
            console.log(`🛠️ Worker: Processing ${event.action} for User ${event.userId}`);

            if (event.action === 'CREATE_ORDER') {
                // REAL DATABASE OPERATION (Finally writing to Mongo)
                const newOrder = new Order({
                    userId: event.userId,
                    productId: event.productId,
                    qty: event.qty,
                    status: 'CONFIRMED'
                });

                await newOrder.save();
                console.log(`✅ Order ${newOrder._id} persisted to MongoDB`);
                
                // Here is where you would call Nodemailer to send an email
            }
        }
    });
}

runWorker().catch(console.error);