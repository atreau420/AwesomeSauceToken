#!/bin/bash

echo "💰 AwesomeSauceToken REAL TRADING Bot Monitor"
echo "=============================================="
echo ""

# Check if bot is running
if ps aux | grep -v grep | grep "gas-efficient-ai-bot.cjs" > /dev/null; then
    echo "✅ Bot Status: RUNNING (REAL TRADING MODE)"
else
    echo "❌ Bot Status: NOT RUNNING"
    echo "   Start with: node gas-efficient-ai-bot.cjs &"
    exit 1
fi

echo ""

# Show trading results
if [ -f "gas_efficient_learning_data.json" ]; then
    echo "📊 REAL Trading Results:"
    echo "------------------------"

    # Extract data from JSON
    successful_trades=$(grep -o '"successfulTrades":[^,]*' gas_efficient_learning_data.json | cut -d: -f2)
    failed_trades=$(grep -o '"failedTrades":[^,]*' gas_efficient_learning_data.json | cut -d: -f2)
    total_profit=$(grep -o '"totalProfit":[^,]*' gas_efficient_learning_data.json | cut -d: -f2)
    gas_costs=$(grep -o '"gasCosts":[^,]*' gas_efficient_learning_data.json | cut -d: -f2)

    echo "✅ Successful Trades: $successful_trades"
    echo "❌ Failed Trades: $failed_trades"
    echo "💰 Total Profit: $total_profit MATIC"
    echo "⛽ Total Gas Costs: $gas_costs MATIC"

    # Calculate net profit
    if command -v bc &> /dev/null; then
        net_profit=$(echo "$total_profit - $gas_costs" | bc -l)
        echo "📈 Net Profit: $net_profit MATIC"
    fi

    echo ""
fi

# Show wallet balance
echo "🏦 Wallet Balance:"
echo "------------------"
node -e "
const { Web3 } = require('web3');
require('dotenv').config();
const web3 = new Web3(process.env.RPC_URL);
web3.eth.getBalance(process.env.WALLET_ADDRESS).then(balance => {
    const balanceInEth = web3.utils.fromWei(balance, 'ether');
    console.log('💰 MATIC Balance:', balanceInEth);
    console.log('📍 Address:', process.env.WALLET_ADDRESS);
}).catch(console.error);
" 2>/dev/null || echo "Unable to check wallet balance"

echo ""

# Show recent bot activity
if [ -f "bot_output.log" ]; then
    echo "🔄 Recent Bot Activity:"
    echo "-----------------------"
    tail -10 bot_output.log | grep -E "(✅|🚀|🎯|💰|⛽|💸)" | tail -5
    echo ""
fi

echo "⚠️  IMPORTANT REMINDERS:"
echo "   • This bot is in REAL TRADING MODE"
echo "   • It will execute actual blockchain transactions"
echo "   • Monitor your wallet balance regularly"
echo "   • Stop the bot with: pkill -f gas-efficient-ai-bot.cjs"
echo ""

echo "💡 Commands:"
echo "   • Check this again: ./monitor-demo-bot.sh"
echo "   • Stop bot: pkill -f gas-efficient-ai-bot.cjs"
echo "   • View full log: tail -f bot_output.log"
echo "   • View results: cat gas_efficient_learning_data.json"
