const Redis = require('redis');
const redisClient = Redis.createClient({
	url: 'redis://localhost:6379'
});

module.exports = redisClient ;
