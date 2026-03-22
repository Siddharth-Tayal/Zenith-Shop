#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' 

GATEWAY_URL="http://localhost:5000"
PRODUCT_ID="prod_$(date +%s)"

echo -e "${MAGENTA}==========================================${NC}"
echo -e "${MAGENTA}    PRODUCT SERVICE: AUTHENTICATED TEST   ${NC}"
echo -e "${MAGENTA}==========================================${NC}"

# --- NEW: TOKEN PROMPT ---
echo -e "${YELLOW}Please paste your JWT Bearer Token (without 'Bearer ' prefix):${NC}"
read -r USER_TOKEN

if [ -z "$USER_TOKEN" ]; then
    echo -e "${RED}Error: Token is required to test protected routes.${NC}"
    exit 1
fi

AUTH_HEADER="Authorization: Bearer $USER_TOKEN"

# 1. CREATE PRODUCT (POST)
echo -e "\n${BLUE}[1/4] Creating Product: $PRODUCT_ID...${NC}"
# Added trailing slash to avoid NGINX 301
CREATE_RES=$(curl -s -X POST "$GATEWAY_URL/api/products/" \
     -H "Content-Type: application/json" \
     -H "$AUTH_HEADER" \
     -d "{
            \"id\": \"$PRODUCT_ID\",
            \"name\": \"Pro Gaming Mouse\",
            \"description\": \"Master-level precision sensor\",
            \"price\": 79.99,
            \"stock\": 100,
            \"category\": \"Electronics\",
            \"tags\": [\"gaming\", \"wireless\", \"rgb\"],
            \"attributes\": { \"dpi\": 25000, \"color\": \"black\" }
          }")

echo -e "${GREEN}Response:${NC} $CREATE_RES"

# 2. VERIFY INSTANT CACHE
echo -e "\n${BLUE}[2/4] Verifying Cache Warm-up (First GET)...${NC}"
FIRST_GET=$(curl -s -H "$AUTH_HEADER" "$GATEWAY_URL/api/products/$PRODUCT_ID")
echo -e "${GREEN}Data:${NC} $FIRST_GET"

if [[ $FIRST_GET == *"redis"* ]]; then
    echo -e "${GREEN}✅ SUCCESS: Product was pre-cached during creation!${NC}"
elif [[ $FIRST_GET == *"Unauthorized"* ]]; then
    echo -e "${RED}❌ FAIL: NGINX rejected the token (401).${NC}"
    exit 1
else
    echo -e "${YELLOW}⚠️ WARNING: Product came from MongoDB. Check setCache logic.${NC}"
fi

# 3. UPDATE PRODUCT (PUT)
echo -e "\n${BLUE}[3/4] Updating Product Price to 799.99...${NC}"
UPDATE_RES=$(curl -s -X PUT "$GATEWAY_URL/api/products/$PRODUCT_ID" \
     -H "Content-Type: application/json" \
     -H "$AUTH_HEADER" \
     -d "{\"price\": 799.99}")
echo -e "${GREEN}Update Response:${NC} $UPDATE_RES"

# 4. VERIFY CACHE INVALIDATION
echo -e "\n${BLUE}[4/4] Verifying Cache Invalidation (Post-Update GET)...${NC}"
FINAL_GET=$(curl -s -H "$AUTH_HEADER" "$GATEWAY_URL/api/products/$PRODUCT_ID")
echo -e "${GREEN}Data:${NC} $FINAL_GET"

if [[ $FINAL_GET == *"mongodb"* ]]; then
    echo -e "${GREEN}✅ SUCCESS: Cache was cleared. Data is fresh from MongoDB.${NC}"
else
    echo -e "${RED}❌ FAIL: Still getting old data from Redis or Request Failed.${NC}"
fi

echo -e "\n${MAGENTA}==========================================${NC}"
echo -e "${BLUE}Test Complete. Check Kafka for events.${NC}"
echo -e "${MAGENTA}==========================================${NC}"