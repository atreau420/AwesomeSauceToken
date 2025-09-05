#!/bin/bash

# 🚀 QUICK RENDER.COM DEPLOYMENT SCRIPT
# Deploy your trading bot to Render.com (FREE 750 hours/month)

echo "🚀 Setting up FREE 24/7 Trading Bot on Render.com"
echo "================================================"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with:"
    echo "PRIVATE_KEY=your_private_key"
    echo "WALLET_ADDRESS=0x6C14Aef8B5AB704abB3f9faF409c6fb304d3f04F"
    echo "RPC_URL=https://polygon-rpc.com"
    exit 1
fi

echo "✅ .env file found"

# Create render.yaml for easy deployment
cat > render.yaml << 'EOF'
services:
  - type: web
    name: trading-bot
    env: node
    buildCommand: npm install
    startCommand: node persistent-launcher.cjs
    envVars:
      - key: NODE_ENV
        value: production
      - key: PRIVATE_KEY
        fromSecret: private_key
      - key: WALLET_ADDRESS
        fromSecret: wallet_address
      - key: RPC_URL
        value: https://polygon-rpc.com
    healthCheckPath: /
    autoDeploy: true
EOF

echo "✅ render.yaml created"

# Create Dockerfile for container deployment
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S tradingbot -u 1001

USER tradingbot

EXPOSE 3000

CMD ["node", "persistent-launcher.cjs"]
EOF

echo "✅ Dockerfile created"

# Create .dockerignore
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.env
.git
.github
README.md
*.md
EOF

echo "✅ .dockerignore created"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Go to https://render.com"
echo "2. Sign up with GitHub (FREE)"
echo "3. Click 'New +' → 'Web Service'"
echo "4. Connect your GitHub repository"
echo "5. Choose 'Docker' as runtime"
echo "6. Add environment variables:"
echo "   - PRIVATE_KEY: your_private_key"
echo "   - WALLET_ADDRESS: 0x6C14Aef8B5AB704abB3f9faF409c6fb304d3f04F"
echo "   - RPC_URL: https://polygon-rpc.com"
echo "7. Click 'Create Web Service'"
echo ""
echo "✅ Your bot will run 24/7 for FREE (750 hours/month)!"
echo ""
echo "📊 Monitor at: https://dashboard.render.com"
