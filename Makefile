# Start everything for development
dev:
	docker-compose up -d
	nodemon services/api-gateway/index.js
# Stop everything
stop:
	docker-compose down
	pkill -f node

# View logs
logs:
	docker-compose logs -f