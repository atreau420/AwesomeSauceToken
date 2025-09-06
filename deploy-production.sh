#!/bin/bash

# Production Deployment Script for Awesome Sauce Token AI Marketplace
# This script deploys to Netlify with blockchain integration

echo "🚀 Starting production deployment..."

# Check if required environment variables are set
if [ -z "$PRIVATE_KEY" ] || [ -z "$POLYGON_RPC_URL" ]; then
    echo "❌ Missing blockchain credentials in environment"
    echo "Please ensure PRIVATE_KEY and POLYGON_RPC_URL are set"
    exit 1
fi

# Step 1: Security audit
echo "🔍 Running security audit..."
npm audit --audit-level=moderate
if [ $? -ne 0 ]; then
    echo "⚠️  Security vulnerabilities found. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled due to security concerns"
        exit 1
    fi
fi

# Step 2: Run tests
echo "🧪 Running test suite..."
npm run test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Deployment cancelled."
    exit 1
fi

# Step 3: Build for production
echo "🏗️  Building for production..."
npm run build:netlify
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Deployment cancelled."
    exit 1
fi

# Step 4: Deploy to Netlify (if netlify CLI is available)
if command -v netlify &> /dev/null; then
    echo "📡 Deploying to Netlify..."
    netlify deploy --prod --dir=. --functions=netlify/functions
    if [ $? -eq 0 ]; then
        echo "✅ Production deployment successful!"
        echo "🌐 Your AI-powered marketplace is now live!"
        echo "📊 Features deployed:"
        echo "   - Dynamic AI pricing optimization"
        echo "   - Advanced strategy generator"
        echo "   - Security anomaly detection"
        echo "   - Real-time event streaming"
        echo "   - Blockchain integration (Polygon)"
        echo ""
        echo "📝 Post-deployment checklist:"
        echo "   1. Set environment variables in Netlify dashboard:"
        echo "      - PRIVATE_KEY (your blockchain private key)"
        echo "      - POLYGON_RPC_URL (Alchemy endpoint)"
        echo "      - ETHERSCAN_API_KEY (for verification)"
        echo "   2. Test all AI endpoints"
        echo "   3. Verify blockchain connectivity"
        echo "   4. Monitor real-time metrics"
        echo ""
        echo "🔗 Access your deployment at: https://your-site.netlify.app"
    else
        echo "❌ Netlify deployment failed"
        exit 1
    fi
else
    echo "📝 Netlify CLI not found. Manual deployment required:"
    echo "1. Go to https://app.netlify.com"
    echo "2. Connect your GitHub repository"
    echo "3. Set build command: npm run build:netlify"
    echo "4. Set publish directory: ."
    echo "5. Set functions directory: netlify/functions"
    echo "6. Add environment variables from .env.production"
    echo ""
    echo "✅ Files are ready for deployment!"
fi

echo "🎉 Deployment process completed!"
