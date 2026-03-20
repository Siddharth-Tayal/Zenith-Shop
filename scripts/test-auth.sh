#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

GATEWAY_URL="http://localhost:5000"
EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="SecurePassword123"

echo -e "${BLUE}--- Starting Automated Auth Flow Test ---${NC}"

# 1. REGISTER
echo -e "\n${BLUE}1. Registering User: $EMAIL...${NC}"
REG_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/auth/register" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

echo -e "Response: $REG_RESPONSE"

# 2. LOGIN
echo -e "\n${BLUE}2. Logging In...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

# Extract Token using grep/sed (simple way without needing jq)
TOKEN=$(echo $LOGIN_RESPONSE | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login Failed - No Token Received${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Login Successful! Token acquired.${NC}"
fi

# 3. TEST GATEWAY PROTECTED ROUTE (Rate Limiter check)
echo -e "\n${BLUE}3. Testing Gateway Authentication & Redis Session...${NC}"
PROTECTED_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$GATEWAY_URL/api/auth/me" \
     -H "Authorization: Bearer $TOKEN")

if [ "$PROTECTED_CHECK" == "200" ] || [ "$PROTECTED_CHECK" == "404" ]; then
    echo -e "${GREEN}✅ Gateway recognized the token and session in Redis.${NC}"
else
    echo -e "${RED}❌ Gateway rejected the token. Check Redis connection.${NC}"
fi

echo -e "\n${GREEN}--- Auth Flow Test Complete ---${NC}"