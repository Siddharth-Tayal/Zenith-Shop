# Define colors for the terminal output
GREEN  := $(shell tput -txterm setaf 2)
YELLOW := $(shell tput -txterm setaf 3)
BLUE   := $(shell tput -txterm setaf 4)
RESET  := $(shell tput -txterm sgr0)

.PHONY: dev stop logs

# Start everything for development
dev:
	@echo "${BLUE}🚀 Starting Docker Containers...${RESET}"
	docker-compose up -d

	@echo "${GREEN}📊 Launching Postgres Studio on http://localhost:5555...${RESET}"
	npx prisma studio --schema=packages/database/postgres/schema.prisma --port 5555 &

	@echo "${GREEN}🍃 Launching MongoDB Studio on http://localhost:5556...${RESET}"
	npx prisma studio --schema=packages/database/mongodb/schema.prisma --port 5556 &

	@echo "${YELLOW}🔐 Starting Auth Service...${RESET}"
	nodemon services/auth-services/index.js &

	@echo "${BLUE}🌉 Starting API Gateway...${RESET}"
	# We run the Gateway last and NOT in the background so we can see the main logs
	nodemon services/api-gateway/index.js

# Stop everything (including background studios and nodes)
stop:
	@echo "${BLUE}🛑 Stopping all services...${RESET}"
	docker-compose down
	# This kills all node processes started by this project
	-pkill -f node
	-pkill -f prisma
	@echo "${GREEN}✅ All services stopped.${RESET}"

# View Docker logs
logs:
	docker-compose logs -f