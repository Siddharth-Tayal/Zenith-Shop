#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
YELLOW='\033[0;33m'
NC='\033[0m' 

GATEWAY_URL="http://localhost:5000"
# Generate a random ID for this test run
PRODUCT_ID="prod_$(date +%s)"

echo -e "${MAGENTA}==========================================${NC}"
echo -e "${MAGENTA}   PRODUCT SERVICE: MIXED-APPROACH TEST   ${NC}"
echo -e "${MAGENTA}==========================================${NC}"

# 1. CREATE PRODUCT (POST)
# This should: Save to Mongo, Warm up Redis, and Emit to Kafka
echo -e "\n${BLUE}[1/4] Creating Product: $PRODUCT_ID...${NC}"
CREATE_RES=$(curl -s -X POST "$GATEWAY_URL/api/products" \
     -H "Content-Type: application/json" \
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

# 2. VERIFY INSTANT CACHE (The "Warm-up" Check)
# Because we used the Mixed Approach, the first GET should be 'source: redis'
echo -e "\n${BLUE}[2/4] Verifying Cache Warm-up (First GET)...${NC}"
FIRST_GET=$(curl -s "$GATEWAY_URL/api/products/$PRODUCT_ID")
echo -e "${GREEN}Data:${NC} $FIRST_GET"

if [[ $FIRST_GET == *"redis"* ]]; then
    echo -e "${GREEN}✅ SUCCESS: Product was pre-cached during creation!${NC}"
else
    echo -e "${YELLOW}⚠️ WARNING: Product came from MongoDB. Check setCache logic.${NC}"
fi

# 3. UPDATE PRODUCT (PUT)
# This should: Update Mongo and Invalidate (Delete) the Redis key
echo -e "\n${BLUE}[3/4] Updating Product Price to 799.99...${NC}"
UPDATE_RES=$(curl -s -X PUT "$GATEWAY_URL/api/products/$PRODUCT_ID" \
     -H "Content-Type: application/json" \
     -d "{\"price\": 799.99}")
echo -e "${GREEN}Update Response:${NC} $UPDATE_RES"

# 4. VERIFY CACHE INVALIDATION
# Now the cache is gone, so this GET must hit MongoDB again
echo -e "\n${BLUE}[4/4] Verifying Cache Invalidation (Post-Update GET)...${NC}"
FINAL_GET=$(curl -s "$GATEWAY_URL/api/products/$PRODUCT_ID")
echo -e "${GREEN}Data:${NC} $FINAL_GET"

if [[ $FINAL_GET == *"mongodb"* ]]; then
    echo -e "${GREEN}✅ SUCCESS: Cache was cleared. Data is fresh from MongoDB.${NC}"
else
    echo -e "${RED}❌ FAIL: Still getting old data from Redis. Invalidation failed.${NC}"
fi

echo -e "\n${MAGENTA}==========================================${NC}"
echo -e "${BLUE}Final Step: Check Kafka logs for 'PRODUCT_CREATED' & 'PRODUCT_UPDATED'${NC}"
echo -e "${MAGENTA}==========================================${NC}"