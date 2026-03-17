#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Prisma Studios...${NC}"

# Function to kill background processes on exit
cleanup() {
    echo -e "\n${BLUE}Stopping Prisma Studios...${NC}"
    kill $PG_STUDIO_PID $MG_STUDIO_PID
    exit
}

# Trap Ctrl+C (SIGINT)
trap cleanup SIGINT

# Start Postgres Studio on Port 5555
echo -e "${GREEN}Launching Postgres Studio on http://localhost:5555...${NC}"
npx prisma studio --schema=packages/database/postgres/schema.prisma --port 5555 &
PG_STUDIO_PID=$!

# Start MongoDB Studio on Port 5556
echo -e "${GREEN}Launching MongoDB Studio on http://localhost:5556...${NC}"
npx prisma studio --schema=packages/database/mongodb/schema.prisma --port 5556 &
MG_STUDIO_PID=$!

echo -e "${BLUE}Both Studios are running. Press Ctrl+C to stop both.${NC}"

# Keep the script running
wait