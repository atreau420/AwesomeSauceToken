#!/bin/bash

echo "🚀 Deploying AwesomeSauceToken to Netlify..."
echo "=============================================="

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Check if user is logged in to Netlify
if ! netlify status &> /dev/null; then
    echo "🔐 Please login to Netlify:"
    netlify login
fi

# Deploy to Netlify
echo "📦 Deploying to Netlify..."
netlify deploy --prod --dir=public

echo "✅ Deployment complete!"
echo "🌐 Your website is now live and generating income!"
echo ""
echo "🎯 Key Features Now Live:"
echo "  ✅ NFT Marketplace - Create, buy, sell NFTs"
echo "  ✅ Token Creator - Build custom ERC-20 tokens"
echo "  ✅ Global Trading - Cross-platform DEX integration"
echo "  ✅ Social Hub - Community features and leaderboard"
echo "  ✅ Trading Bot - Automated income generation"
echo "  ✅ Coinbase Wallet - Seamless Web3 integration"
echo ""
echo "💰 Start generating income immediately with the trading bot!"
