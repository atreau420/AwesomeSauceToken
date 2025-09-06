#!/bin/bash

# Production Health Check Script
# Verifies all AI marketplace features are working

if [ -z "$1" ]; then
    echo "Usage: $0 <your-netlify-url>"
    echo "Example: $0 https://awesome-sauce-marketplace.netlify.app"
    exit 1
fi

BASE_URL=$1
echo "🔍 Health checking AI marketplace at: $BASE_URL"
echo ""

# Function to make HTTP request and check response
check_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    echo -n "Testing $description... "
    response=$(curl -s -w "%{http_code}" -o /tmp/response "$BASE_URL$endpoint")
    
    if [ "$response" -eq "$expected_status" ]; then
        echo "✅ OK ($response)"
    else
        echo "❌ FAILED ($response)"
        echo "Response: $(cat /tmp/response)"
    fi
}

# Core health checks
echo "🏥 Core Health Checks:"
check_endpoint "/health" 200 "Health endpoint"
check_endpoint "/api/marketplace/listings" 200 "Marketplace listings"

echo ""
echo "🤖 AI Features Check:"
check_endpoint "/api/ai/optimizer/status" 401 "AI optimizer (auth required)"
check_endpoint "/api/ai/suggestions" 401 "AI suggestions (auth required)" 
check_endpoint "/api/ai/strategy/generate" 401 "Strategy generator (auth required)"
check_endpoint "/api/ai/security/scan" 401 "Security scanner (auth required)"

echo ""
echo "📊 Analytics Check:"
check_endpoint "/api/ai/analytics/metrics" 401 "Analytics metrics (auth required)"

echo ""
echo "🎮 Marketplace Features:"
check_endpoint "/api/marketplace/aggregate?platforms=internal&limit=5" 200 "Aggregate listings"
check_endpoint "/api/auctions/active" 200 "Active auctions"
check_endpoint "/api/bundles/active" 200 "Active bundles"

echo ""
echo "🔐 Security Features:"
check_endpoint "/api/auth/nonce" 200 "Auth nonce generation"

echo ""
echo "📡 Real-time Features:"
echo -n "Testing event stream... "
timeout 3s curl -s "$BASE_URL/events/stream" > /dev/null
if [ $? -eq 124 ]; then
    echo "✅ OK (stream active)"
else
    echo "❌ FAILED (stream not responding)"
fi

echo ""
echo "🌐 Frontend Check:"
check_endpoint "/" 200 "Homepage"
check_endpoint "/robots.txt" 404 "Robots.txt (expected 404)"

echo ""
echo "📊 Performance Metrics:"
echo -n "Response time test... "
start_time=$(date +%s%N)
curl -s "$BASE_URL/health" > /dev/null
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))
echo "✅ ${duration}ms"

echo ""
echo "🎉 Health check completed!"
echo ""
echo "📝 Next steps:"
echo "1. Test admin features by authenticating"
echo "2. Verify blockchain connectivity in browser"
echo "3. Test AI features through the UI"
echo "4. Monitor function logs in Netlify dashboard"
echo ""
echo "🔗 Access your live marketplace: $BASE_URL"

# Cleanup
rm -f /tmp/response
