#!/bin/bash

# 🚀 AwesomeSauceToken Maximum Profit Bot - Quick Status Check
# Shows essential bot status in seconds

echo "🚀 AwesomeSauceToken MAXIMUM PROFIT Bot Status"
echo "==============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if service is running
echo -e "${BLUE}🤖 Bot Service Status:${NC}"
if systemctl is-active --quiet awesomesauce-maxprofit-bot.service 2>/dev/null; then
    echo -e "${GREEN}✅ RUNNING${NC}"
else
    echo -e "${RED}❌ STOPPED${NC}"
fi

# Check if process is running
echo -e "${BLUE}🔄 Bot Process:${NC}"
BOT_PID=$(pgrep -f "independent-trading-bot" | head -1)
if [ ! -z "$BOT_PID" ]; then
    echo -e "${GREEN}✅ ACTIVE (PID: $BOT_PID)${NC}"
else
    echo -e "${RED}❌ NOT FOUND${NC}"
fi

# Check configuration
echo -e "${BLUE}⚙️ Configuration:${NC}"
if [ -f ".env" ]; then
    if grep -q "PRIVATE_KEY=" .env && grep -q "WALLET_ADDRESS=" .env; then
        echo -e "${GREEN}✅ Wallet configured${NC}"
    else
        echo -e "${RED}❌ Wallet NOT configured${NC}"
    fi
else
    echo -e "${RED}❌ .env file missing${NC}"
fi

# Check logs
echo -e "${BLUE}📊 Performance Logs:${NC}"
if [ -f "bot-performance.log" ]; then
    TRADES=$(wc -l < bot-performance.log)
    echo -e "${GREEN}✅ $TRADES trades recorded${NC}"
else
    echo -e "${YELLOW}⚠️ No performance data yet${NC}"
fi

# System resources
echo -e "${BLUE}💻 System Resources:${NC}"
CPU=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
MEM=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
echo -e "${GREEN}CPU: ${CPU}% | Memory: ${MEM}%${NC}"

echo ""
echo -e "${BLUE}🎯 Quick Commands:${NC}"
echo "  Start:   npm run bot:start"
echo "  Stop:    npm run bot:stop"
echo "  Monitor: npm run bot:monitor"
echo "  Logs:    npm run bot:logs"
echo ""
echo -e "${YELLOW}⚠️ Remember: Monitor closely and start small!${NC}"
