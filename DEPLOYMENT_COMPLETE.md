# AwesomeSauce Token - Production Deployment Guide

## 🚀 Quick Start for Production

### Prerequisites
- Ubuntu/Debian server with root access
- Domain name with SSL certificate
- Node.js 18+ installed
- Git installed

### 1. Clone and Setup
```bash
git clone https://github.com/atreau420/AwesomeSauceToken.git
cd AwesomeSauceToken
npm install
```

### 2. Configure Environment
```bash
cp .env.production .env
nano .env
```

**CRITICAL:** Update these values in `.env`:
- `MARKETPLACE_TREASURY` - Your treasury wallet address
- `PRIVATE_KEY` - Trading bot private key
- `ETH_RPC_URL` - Production Ethereum RPC endpoint
- `BASE_RPC_URL` - Production Base network RPC endpoint
- `ALLOWED_ORIGINS` - Your domain (e.g., https://yourdomain.com)

### 3. Deploy to Production
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

### 4. Verify Deployment
```bash
# Check service status
sudo systemctl status awesomesauce-marketplace

# View logs
journalctl -u awesomesauce-marketplace -f

# Test API
curl https://yourdomain.com/api/marketplace/listings
```

## 🔐 Security Features Implemented

### ✅ On-Chain Transaction Validation
- Validates transaction sender matches authenticated wallet
- Verifies recipient is the treasury address
- Confirms exact payment amount matches listing price
- Requires minimum block confirmations
- Records validation status in database

### ✅ Rate Limiting
- General API: 100 requests per 15 minutes
- Authentication: 20 attempts per 15 minutes  
- Purchases: 10 transactions per hour
- Configurable and environment-specific

### ✅ Wallet-Only Authentication
- Nonce-based signature authentication
- No passwords or traditional login
- Session tokens with 24-hour expiry
- Buyer address must match authenticated wallet

### ✅ Enhanced Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options and X-Content-Type-Options
- XSS protection and referrer policy

## 💰 Marketplace Features

### Real Transaction Flow
1. **Connect Wallet** - MetaMask/WalletConnect integration
2. **Authenticate** - Sign nonce for session token
3. **Browse Listings** - View available products/services
4. **Purchase** - Send ETH transaction to treasury
5. **Validation** - Automatic on-chain verification
6. **Completion** - Purchase marked as complete when validated

### Purchase Management
- Purchase history for authenticated users
- Status tracking (pending/completed/failed)
- Automatic retry for failed validations
- Transaction hash recording for audit trail

## 📊 Available Endpoints

### Public Endpoints
- `GET /api/marketplace/listings` - Get active listings
- `GET /api/marketplace/stats` - Get marketplace statistics
- `GET /health` - Health check

### Authenticated Endpoints  
- `POST /api/auth/nonce` - Request authentication nonce
- `POST /api/auth/verify` - Verify wallet signature
- `GET /api/auth/session` - Check session status
- `GET /api/marketplace/purchases` - Get user purchase history
- `POST /api/marketplace/purchase` - Submit purchase transaction
- `POST /api/marketplace/validate/:id` - Validate specific purchase

## 🎯 Frontend Features

### Navigation
- Integrated marketplace link in main navigation
- Seamless wallet connection flow
- Real-time purchase status updates

### User Experience
- Progressive loading states
- Error handling with user-friendly messages
- Purchase history display
- Transaction status polling

## 🚨 Monitoring & Maintenance

### Critical Monitoring Points
1. **Treasury Balance** - Monitor incoming payments
2. **Transaction Validation** - Check for failed validations
3. **API Performance** - Monitor response times
4. **Error Rates** - Track failed requests
5. **Database Health** - Monitor SQLite database

### Log Locations
- Application logs: `journalctl -u awesomesauce-marketplace`
- Database file: `/var/lib/awesomesauce/marketplace.db`
- SSL certificates: Check paths in `.env`

### Backup Strategy
```bash
# Backup database
cp /var/lib/awesomesauce/marketplace.db ./marketplace-backup-$(date +%Y%m%d).db

# Backup application
tar -czf awesomesauce-backup-$(date +%Y%m%d).tar.gz /var/www/awesomesauce
```

## 🔧 Troubleshooting

### Common Issues

**Service won't start:**
```bash
sudo systemctl status awesomesauce-marketplace
journalctl -u awesomesauce-marketplace -n 50
```

**SSL certificate errors:**
- Verify certificate paths in `.env`
- Check certificate expiration
- Ensure proper permissions on cert files

**Transaction validation failing:**
- Check RPC endpoint connectivity
- Verify treasury address configuration
- Review validation error logs

**Rate limiting too restrictive:**
- Adjust limits in production-server.ts
- Rebuild and restart service

### Emergency Procedures

**Stop all services:**
```bash
sudo systemctl stop awesomesauce-marketplace
sudo ufw deny 443
sudo ufw deny 80
```

**Restart services:**
```bash
sudo systemctl start awesomesauce-marketplace
sudo ufw allow 443
sudo ufw allow 80
```

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- [ ] Weekly security updates (`apt update && apt upgrade`)
- [ ] Monthly SSL certificate check
- [ ] Quarterly security audit using `PRODUCTION_SECURITY.md`
- [ ] Database backup verification
- [ ] Performance metrics review

### Support Resources
- GitHub Issues: https://github.com/atreau420/AwesomeSauceToken/issues
- Security Checklist: `PRODUCTION_SECURITY.md`
- Deployment Logs: `journalctl -u awesomesauce-marketplace`

---

## 🎉 Ready for Production!

Your AwesomeSauce Token marketplace is now production-ready with:
- ✅ Enterprise-grade security
- ✅ On-chain transaction validation  
- ✅ Comprehensive rate limiting
- ✅ Real-time purchase processing
- ✅ Complete audit trail
- ✅ Professional deployment automation

**Start generating real income through secure wallet-only transactions!**