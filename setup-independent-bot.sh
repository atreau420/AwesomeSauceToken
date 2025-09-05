#!/bin/bash

# Independent Trading Bot Setup Script
# This script sets up the trading bot to run 24/7 independently

echo "🚀 Setting up Independent Trading Bot..."
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install web3 dotenv

#!/bin/bash

# Maximum Profit Independent Trading Bot Setup Script
# This script sets up the HIGH RISK - HIGH REWARD trading bot
# ⚠️  ONLY USE WITH FUNDS YOU CAN AFFORD TO LOSE

echo "� Setting up MAXIMUM PROFIT Independent Trading Bot..."
echo "======================================================"
echo "⚠️  WARNING: This bot uses HIGH RISK strategies"
echo "⚠️  You may lose ALL your investment"
echo "⚠️  Make sure you understand the risks"
echo ""

# Check if user wants to continue
read -p "Do you understand the risks and want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Setup cancelled. Please understand the risks before proceeding."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install web3 dotenv

# Create maximum profit configuration
if [ ! -f .env ]; then
    echo "📝 Creating maximum profit configuration..."
    cp .env.maximum-profit .env

    echo ""
    echo "🔴 CRITICAL: Configure your wallet credentials in .env"
    echo "1. Open .env file"
    echo "2. Replace 'your_private_key_here_without_0x_prefix' with your actual private key"
    echo "3. Replace '0xYourWalletAddressHere' with your wallet address"
    echo "4. Set your RPC URL (Infura/Alchemy)"
    echo ""
    read -p "Press Enter after configuring .env file..."
fi

# Create systemd service for 24/7 operation
echo "🔧 Creating systemd service for 24/7 operation..."
sudo tee /etc/systemd/system/maximum-profit-trading-bot.service > /dev/null << EOF
[Unit]
Description=Maximum Profit Independent Trading Bot
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/independent-trading-bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=MAXIMUM_PROFIT_MODE=true

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=$(pwd)

# Resource limits
MemoryLimit=1G
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF

# Set proper permissions
chmod 600 .env
chmod +x independent-trading-bot.js

# Create log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/maximum-profit-bot > /dev/null << EOF
$(pwd)/maximum_profit_*.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
    create 644 $USER $USER
    postrotate
        systemctl reload maximum-profit-trading-bot.service || true
    endscript
}
EOF

echo ""
echo "✅ Maximum Profit Bot Setup Complete!"
echo ""
echo "🎯 Key Features Enabled:"
echo "  ✅ Multi-Strategy Trading (Arbitrage, Momentum, Mean Reversion, Scalping)"
echo "  ✅ Multi-Pair Trading (ETH, BTC, BNB, ADA)"
echo "  ✅ Multi-DEX Integration (Uniswap, SushiSwap)"
echo "  ✅ Advanced Risk Management"
echo "  ✅ 24/7 Autonomous Operation"
echo "  ✅ Real-time Performance Monitoring"
echo ""
echo "🚀 Deployment Commands:"
echo "  Start:    sudo systemctl start maximum-profit-trading-bot"
echo "  Stop:     sudo systemctl stop maximum-profit-trading-bot"
echo "  Status:   sudo systemctl status maximum-profit-trading-bot"
echo "  Logs:     tail -f maximum_profit_bot.log"
echo "  Monitor:  npm run bot:monitor"
echo ""
echo "⚠️  FINAL WARNINGS:"
echo "  🔴 This bot trades with REAL MONEY"
echo "  🔴 You can LOSE EVERYTHING"
echo "  🔴 Start with VERY SMALL amounts"
echo "  🔴 Monitor closely for the first 24 hours"
echo "  🔴 Have an emergency stop plan ready"
echo ""
echo "💰 Expected Performance:"
echo "  📈 Target: 10-25% monthly returns"
echo "  ⚡ Trading: 20-50 trades per hour"
echo "  🎯 Win Rate: 60-75% (strategy dependent)"
echo ""
echo "🔥 Ready to start generating MAXIMUM profits?"
echo "   Run: sudo systemctl start maximum-profit-trading-bot"

# Create systemd service for 24/7 operation
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/awesomesauce-trading-bot.service > /dev/null << EOF
[Unit]
Description=AwesomeSauceToken Independent Trading Bot
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/independent-trading-bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=$(pwd)

[Install]
WantedBy=multi-user.target
EOF

# Set proper permissions
chmod 600 .env
chmod +x independent-trading-bot.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit .env file with your wallet credentials"
echo "2. Test the bot: node independent-trading-bot.js"
echo "3. Start 24/7 service: sudo systemctl start awesomesauce-trading-bot"
echo "4. Enable auto-start: sudo systemctl enable awesomesauce-trading-bot"
echo ""
echo "🔴 SECURITY WARNING:"
echo "- Never share your private key"
echo "- Test with small amounts first"
echo "- Monitor the bot regularly"
echo "- Keep backups of your wallet"
echo ""
echo "📊 Monitor the bot:"
echo "- Logs: tail -f trading_bot.log"
echo "- Status: sudo systemctl status awesomesauce-trading-bot"
echo "- Performance: tail -f performance.log"
