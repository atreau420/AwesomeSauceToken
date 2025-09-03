#!/bin/bash

# AwesomeSauceToken System Monitor
# Run: ./monitor.sh

echo "🔍 AwesomeSauceToken System Monitor"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check URL
check_url() {
    local url=$1
    local name=$2

    if curl -s --max-time 10 "$url" > /dev/null; then
        echo -e "${GREEN}✅ $name: OK${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: DOWN${NC}"
        return 1
    fi
}

# Function to check API endpoint
check_api() {
    local url=$1
    local name=$2

    response=$(curl -s --max-time 10 "$url" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        echo -e "${GREEN}✅ $name: OK${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: DOWN${NC}"
        return 1
    fi
}

# Main monitoring
echo "🌐 Checking Website Status..."
check_url "https://www.awesomesaucetoken.world" "Main Website"
check_url "https://awesomemark-auto-token.netlify.app" "Backup Site"

echo ""
echo "🔌 Checking API Endpoints..."
check_api "https://www.awesomesaucetoken.world/api/health" "Health Check"
check_api "https://www.awesomesaucetoken.world/api/bot/status" "Bot Status"

echo ""
echo "💰 Checking Revenue Systems..."
# Add revenue checks here when implemented

echo ""
echo "📊 System Resources..."
echo "Disk Usage: $(df -h / | tail -1 | awk '{print $5}')"
echo "Memory Usage: $(free -h | grep Mem | awk '{print $3 "/" $2}')"

echo ""
echo "🔄 Last Update: $(date)"
echo "Next check in 5 minutes... (Ctrl+C to stop)"

# Auto-restart monitoring
while true; do
    sleep 300
    clear
    exec $0
done
