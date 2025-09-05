#!/bin/bash

# 🚀 AwesomeSauceToken MAXIMUM PROFIT Bot - Quick Setup Script
# ⚠️  HIGH RISK - HIGH REWARD Trading Bot Setup

echo "🚀 AwesomeSauceToken MAXIMUM PROFIT Bot Setup"
echo "⚠️  WARNING: This bot trades with REAL CRYPTOCURRENCIES"
echo "⚠️  You can LOSE ALL your funds if not configured properly"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    print_error "Do NOT run this script as root!"
    print_error "Run as your regular user with sudo access when needed."
    exit 1
fi

print_header "Checking system requirements..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    print_status "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ required. Current: $(node --version)"
    exit 1
fi
print_status "✅ Node.js $(node --version) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed!"
    exit 1
fi
print_status "✅ npm $(npm --version) detected"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found! Run this script from the project root."
    exit 1
fi

print_header "Installing dependencies..."
npm install

print_header "Setting up maximum profit configuration..."

# Check if .env.maximum-profit exists
if [ ! -f ".env.maximum-profit" ]; then
    print_error ".env.maximum-profit template not found!"
    exit 1
fi

# Copy configuration template
cp .env.maximum-profit .env
print_status "✅ Configuration template copied to .env"

print_warning "⚠️  CRITICAL: You must configure your wallet credentials in .env"
print_warning "⚠️  PRIVATE_KEY and WALLET_ADDRESS are required"
print_warning "⚠️  NEVER share your private key with anyone!"

# Ask user if they want to edit .env now
read -p "Do you want to edit the .env file now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    else
        print_warning "No editor found. Please manually edit .env file"
        print_status "Required: PRIVATE_KEY, WALLET_ADDRESS, RPC_URL"
    fi
fi

print_header "Setting up systemd service for 24/7 operation..."

# Create systemd service file
SERVICE_FILE="/etc/systemd/system/awesomesauce-maxprofit-bot.service"

sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=AwesomeSauceToken Maximum Profit Trading Bot
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/independent-trading-bot.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

print_status "✅ Systemd service created"

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable awesomesauce-maxprofit-bot.service
print_status "✅ Service enabled for auto-start on boot"

print_header "Creating monitoring and management scripts..."

# Create monitoring script
cat > monitor-bot.sh << 'EOF'
#!/bin/bash
echo "📊 AwesomeSauceToken Maximum Profit Bot Monitor"
echo "=================================================="
echo ""

# Check if service is running
if systemctl is-active --quiet awesomesauce-maxprofit-bot.service; then
    echo "✅ Bot service is RUNNING"
else
    echo "❌ Bot service is STOPPED"
fi

echo ""
echo "🔄 Recent service status:"
sudo systemctl status awesomesauce-maxprofit-bot.service --no-pager -l | tail -10

echo ""
echo "📈 Recent logs:"
sudo journalctl -u awesomesauce-maxprofit-bot.service -n 20 --no-pager

echo ""
echo "💰 Performance summary:"
if [ -f "bot-performance.log" ]; then
    tail -10 bot-performance.log
else
    echo "No performance log found yet"
fi
EOF

chmod +x monitor-bot.sh
print_status "✅ Monitor script created"

# Create emergency stop script
cat > emergency-stop.sh << 'EOF'
#!/bin/bash
echo "🛑 EMERGENCY STOP - AwesomeSauceToken Maximum Profit Bot"
echo "========================================================"
echo ""

echo "Stopping bot service..."
sudo systemctl stop awesomesauce-maxprofit-bot.service

echo "Killing any remaining processes..."
pkill -f independent-trading-bot

echo "Checking for remaining processes..."
ps aux | grep independent-trading-bot | grep -v grep

echo ""
echo "✅ Bot stopped successfully"
echo "💡 To restart: npm run bot:start"
EOF

chmod +x emergency-stop.sh
print_status "✅ Emergency stop script created"

print_header "Final security check..."

# Check .env file permissions
if [ -f ".env" ]; then
    ENV_PERMS=$(stat -c "%a" .env)
    if [ "$ENV_PERMS" != "600" ]; then
        chmod 600 .env
        print_status "✅ .env file permissions secured (600)"
    fi
else
    print_warning "⚠️  .env file not found! You must create it with your wallet credentials"
fi

print_header "Setup complete! 🎉"
echo ""
print_status "🚀 Your maximum profit bot is ready!"
echo ""
print_warning "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Edit .env file with your wallet credentials"
echo "2. Test with small amounts first"
echo "3. Monitor performance closely"
echo "4. Never invest more than you can lose"
echo ""
print_status "📋 Useful commands:"
echo "  Start bot:    npm run bot:start"
echo "  Monitor:      ./monitor-bot.sh"
echo "  Stop:         npm run bot:stop"
echo "  Emergency:    ./emergency-stop.sh"
echo "  Logs:         npm run bot:logs"
echo ""
print_status "📖 Read MAXIMUM_PROFIT_BOT_README.md for detailed instructions"
echo ""
print_warning "💀 REMEMBER: This is HIGH RISK trading. You can lose everything!"
echo ""
read -p "Press Enter to continue with starting the bot (or Ctrl+C to cancel)..."

print_header "Starting maximum profit generation... 🚀"

# Start the service
sudo systemctl start awesomesauce-maxprofit-bot.service

# Wait a moment and check status
sleep 3
if systemctl is-active --quiet awesomesauce-maxprofit-bot.service; then
    print_status "✅ Maximum profit bot is now RUNNING 24/7!"
    print_status "📊 Monitor with: ./monitor-bot.sh"
else
    print_error "❌ Failed to start bot service"
    print_status "Check logs with: sudo journalctl -u awesomesauce-maxprofit-bot.service"
fi

echo ""
print_status "🎯 Bot is configured for:"
echo "   • Multi-strategy trading (Arbitrage, Momentum, Mean Reversion, Scalping)"
echo "   • Multi-pair trading (ETH, BTC, BNB, ADA)"
echo "   • Multi-DEX integration (Uniswap, SushiSwap)"
echo "   • 24/7 autonomous operation"
echo "   • Maximum profit generation"
echo ""
print_warning "⚠️  Monitor closely for the first 24 hours!"
print_status "📞 Support: Check logs and adjust settings as needed"
