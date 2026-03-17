import { Kafka } from 'kafkajs';

const kafka = new Kafka({
    clientId: 'zenith-app',
    brokers: [process.env.KAFKA_BORKERS || 'localhost:9092']
});

const producer = kafka.producer();
let isProducerConnected = false;

export const KafkaUtil = {
  async emit(topic, payload) {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
    }
    
    await producer.send({
      topic,
      messages: [
        { 
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            data: payload 
          }) 
        }
      ],
    });
    console.log(`[Kafka Event] Sent to topic: ${topic}`);
  },

  async listen(groupId, topic, handler) {
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    console.log(`[Kafka Consumer] Listening on ${topic}...`);

    await consumer.run({
      eachMessage: async ({ message }) => {
        const rawValue = message.value.toString();
        const parsedData = JSON.parse(rawValue);
        
        try {
          await handler(parsedData);
        } catch (error) {
          console.error(`[Kafka Error] Processing ${topic}:`, error);
        }
      },
    });
  }
};
