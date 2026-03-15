const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: 'zenith-app',
    brokers: ['localhost:9092']
});

module.exports = kafka ;
