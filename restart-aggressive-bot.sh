#!/bin/bash

echo "🚀 RESTARTING GAS-EFFICIENT AI BOT WITH AGGRESSIVE $1M GROWTH PARAMETERS"
echo "======================================================================"
echo ""

# Kill any existing bot processes
echo "🛑 Stopping existing bot processes..."
pkill -f "gas-efficient-ai-bot.cjs" 2>/dev/null || echo "No existing bot processes found"

# Wait a moment
sleep 2

# Start the bot with aggressive parameters
echo "🚀 Starting bot with MAXIMUM AGGRESSIVE GROWTH mode..."
echo "   - 50-80% balance usage per trade"
echo "   - 60 trades per hour maximum"
echo "   - 1.01x profit-to-gas ratio minimum"
echo "   - Accept any gas price (1-500 gwei)"
echo "   - Small balance mode: 1.01x gas cost minimum"
echo ""

# Start the bot in background
node gas-efficient-ai-bot.cjs &

# Wait for bot to start
sleep 3

# Check if bot started successfully
if ps aux | grep -v grep | grep "gas-efficient-ai-bot.cjs" > /dev/null; then
    echo "✅ Bot successfully restarted in AGGRESSIVE GROWTH mode!"
    echo ""
    echo "📊 Monitoring bot performance..."
    echo "   Use: ./monitor-demo-bot.sh to check status"
    echo "   Use: tail -f bot_output.log to see live output"
else
    echo "❌ Bot failed to start. Check logs for errors."
    exit 1
fi

echo ""
echo "🎯 TARGET: Grow ~$0.005 balance to $1M through maximum risk trading"
echo "⚠️  WARNING: This is extremely high-risk trading with minimal profit requirements"
