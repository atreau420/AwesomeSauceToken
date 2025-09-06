# Netlify Environment Setup for AI Marketplace

## Required Environment Variables

Set these in your Netlify dashboard (Site settings > Environment variables):

### Blockchain Access
```
PRIVATE_KEY=b93138aabe8248db0576c148d91af416ee6692e957b85594c52b5087bf22af49
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/9XZIQEYW7HQM9S5VEIAZDFIP5GFH4U6AD2
ETHERSCAN_API_KEY=9XZIQEYW7HQM9S5VEIAZDFIP5GFH4U6AD2
```

### Core Settings
```
NODE_ENV=production
AI_PRICING_ENABLED=true
AI_ADJUSTMENT_INTERVAL_MS=60000
FEATURED_DAILY_RATE_ETH=0.001
SPONSORED_SLOT_RATE_ETH=0.005
PLATFORM_FEE_BP=150
REFERRAL_BONUS_BP=100
```

### Security
```
SESSION_SECRET=your_secure_session_secret_here_change_me
ADMIN_PASSWORD=your_secure_admin_password_change_me
CORS_ORIGIN=https://your-site-name.netlify.app
```

### Performance
```
MAX_REQUESTS_PER_MINUTE=1000
CACHE_TTL=300
LOG_LEVEL=info
```

## Deployment Steps

1. **Connect GitHub to Netlify**
   - Go to https://app.netlify.com
   - Click "New site from Git"
   - Connect your GitHub account
   - Select the AwesomeSauceToken repository

2. **Build Settings**
   - Build command: `npm run build:netlify`
   - Publish directory: `.`
   - Functions directory: `netlify/functions`

3. **Environment Variables**
   - Go to Site settings > Environment variables
   - Add all variables from above
   - **Important**: Use your actual domain for CORS_ORIGIN

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete
   - Your AI marketplace will be live!

## Post-Deployment Verification

### Test Core Endpoints
- `https://your-site.netlify.app/health` - Health check
- `https://your-site.netlify.app/api/marketplace/listings` - Marketplace data
- `https://your-site.netlify.app/api/ai/optimizer/status` - AI status (requires auth)

### Test AI Features
1. **Dynamic Pricing**: Visit site and check AI monetization panel
2. **Strategy Generator**: Use the AI strategy form in the dashboard
3. **Security Scanner**: Check anomaly detection in admin panel

### Verify Blockchain Integration
- Check browser console for blockchain connection status
- Test wallet connection functionality
- Verify Polygon network connectivity

## Troubleshooting

### Build Failures
- Check build logs in Netlify dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version (should be 20+)

### Function Errors
- Check function logs in Netlify dashboard
- Verify environment variables are set correctly
- Test functions locally first

### Blockchain Issues
- Verify private key format (64 characters, no 0x prefix)
- Check Alchemy endpoint is accessible
- Confirm Etherscan API key is valid

## Security Considerations

1. **Private Key**: Ensure it's properly secured in Netlify environment variables
2. **CORS**: Set CORS_ORIGIN to your exact Netlify domain
3. **Admin Password**: Use a strong password for admin functions
4. **Session Secret**: Generate a secure random string

## Performance Optimization

- Static assets are automatically cached by Netlify CDN
- Functions have automatic scaling
- Monitor function execution time in dashboard
- Use edge functions for better performance if needed

Your AI-powered marketplace is now ready for production! 🚀
