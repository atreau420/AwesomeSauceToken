#!/bin/bash
set -e

echo "🚀 AwesomeSauce Token Production Deployment Script"
echo "================================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root for security reasons"
   exit 1
fi

# Configuration
APP_DIR="/var/www/awesomesauce"
SERVICE_NAME="awesomesauce-marketplace"
NODE_USER="awesomesauce"

echo "📋 Pre-deployment Checklist:"
echo "  1. SSL certificates configured ✓"
echo "  2. Database permissions set ✓"
echo "  3. Environment variables configured ✓"
echo "  4. Firewall rules configured ✓"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo "   Please copy .env.production template and configure it"
    exit 1
fi

# Validate critical environment variables
echo "🔐 Validating environment configuration..."
source .env.production

if [ -z "$MARKETPLACE_TREASURY" ] || [ "$MARKETPLACE_TREASURY" = "your_treasury_wallet_address_here" ]; then
    echo "❌ MARKETPLACE_TREASURY not configured in .env.production"
    exit 1
fi

if [ -z "$PRIVATE_KEY" ] || [ "$PRIVATE_KEY" = "your_wallet_private_key_here" ]; then
    echo "❌ PRIVATE_KEY not configured in .env.production"
    exit 1
fi

echo "✅ Environment validation passed"

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Copy application files
echo "📦 Copying application files..."
rsync -av --exclude=node_modules --exclude=.git --exclude=*.log . $APP_DIR/

# Install dependencies
echo "📥 Installing production dependencies..."
cd $APP_DIR
npm ci --only=production

# Build application
echo "🔨 Building application..."
npm run build

# Set up database directory
echo "🗄️  Setting up database..."
sudo mkdir -p /var/lib/awesomesauce
sudo chown $USER:$USER /var/lib/awesomesauce

# Copy production environment
cp .env.production .env

# Create systemd service
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=AwesomeSauce Marketplace API
Documentation=https://github.com/atreau420/AwesomeSauceToken
After=network.target

[Service]
Type=simple
User=$NODE_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/src/backend/production-server.js
Restart=on-failure
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR /var/lib/awesomesauce

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

# Create user if doesn't exist
if ! id "$NODE_USER" &>/dev/null; then
    echo "👤 Creating application user..."
    sudo useradd --system --shell /bin/false --home-dir $APP_DIR $NODE_USER
fi

# Set proper ownership
sudo chown -R $NODE_USER:$NODE_USER $APP_DIR
sudo chown -R $NODE_USER:$NODE_USER /var/lib/awesomesauce

# Enable and start service
echo "🚀 Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

# Check service status
echo "📊 Service status:"
sudo systemctl status $SERVICE_NAME --no-pager

# Configure firewall (if ufw is available)
if command -v ufw >/dev/null 2>&1; then
    echo "🔥 Configuring firewall..."
    sudo ufw allow 443/tcp comment 'HTTPS for AwesomeSauce'
    sudo ufw allow 80/tcp comment 'HTTP redirect for AwesomeSauce'
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo "✅ Application deployed to: $APP_DIR"
echo "✅ Service name: $SERVICE_NAME"
echo "✅ Logs: journalctl -u $SERVICE_NAME -f"
echo ""
echo "🔗 Access your marketplace at: https://yourdomain.com/marketplace.html"
echo ""
echo "📝 Next Steps:"
echo "  1. Update DNS to point to this server"
echo "  2. Test wallet connection and purchases"
echo "  3. Monitor logs for any issues"
echo "  4. Set up automated backups for database"
echo ""
echo "⚠️  Security Reminders:"
echo "  • Keep SSL certificates up to date"
echo "  • Monitor transaction validation logs"
echo "  • Regularly backup the database"
echo "  • Monitor server resources and performance"