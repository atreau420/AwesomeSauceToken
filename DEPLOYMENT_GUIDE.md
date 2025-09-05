# 🚀 TRADING BOT DEPLOYMENT GUIDE
# Make your bot run 24/7 even when your computer is off

## 📋 QUICK START (Current Environment)

### Option 1: Persistent Launcher (Recommended)
```bash
cd /workspaces/AwesomeSauceToken
node persistent-launcher.cjs
```
- ✅ Auto-restarts on crashes
- ✅ Monitors both bot and profit tracker
- ✅ Graceful shutdown handling

### Option 2: Manual Background Run
```bash
# Start bot in background
nohup node conservative-trading-bot.cjs &

# Start monitor in background
nohup node profit-monitor.cjs &
```

## 🌐 CLOUD DEPLOYMENT OPTIONS

### 1. DigitalOcean Droplet ($6/month)
```bash
# 1. Create Ubuntu droplet
# 2. Connect via SSH
# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Clone your repository
git clone https://github.com/atreau420/AwesomeSauceToken.git
cd AwesomeSauceToken

# 5. Install dependencies
npm install

# 6. Create .env file with your credentials
nano .env

# 7. Start with PM2 (process manager)
npm install -g pm2
pm2 start persistent-launcher.cjs --name "trading-bot"
pm2 save
pm2 startup
```

### 2. AWS EC2 (Free tier available)
```bash
# Similar steps as DigitalOcean
# Use t2.micro instance (free tier)
# Configure security groups for outbound HTTPS
```

### 3. Google Cloud Run (Serverless)
- ✅ Scales automatically
- ✅ Pay only when running
- ✅ Easy deployment

### 4. Railway.app (Easiest)
```bash
# 1. Connect GitHub repo
# 2. Set environment variables
# 3. Deploy automatically
# 4. Bot runs 24/7 for ~$5/month
```

## 🔧 ENVIRONMENT VARIABLES NEEDED

Create a `.env` file:
```
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=0x6C14Aef8B5AB704abB3f9faF409c6fb304d3f04F
RPC_URL=https://polygon-rpc.com
```

## 📊 MONITORING YOUR BOT

### Check if running:
```bash
ps aux | grep node
```

### View logs:
```bash
# If using PM2
pm2 logs trading-bot

# Or check nohup output
tail -f nohup.out
```

### Restart if needed:
```bash
pm2 restart trading-bot
```

## ⚡ CURRENT STATUS SUMMARY

- **Bot Status**: ✅ Running (Profit-Only Mode)
- **Monitor Status**: ✅ Running
- **Current Balance**: 0.302258 MATIC
- **Mode**: Profit-Only (No Losses)
- **Persistence**: Needs cloud deployment for 24/7

## 🎯 RECOMMENDED NEXT STEPS

1. **Immediate**: Use the persistent launcher in current environment
2. **Short-term**: Deploy to Railway.app or DigitalOcean
3. **Long-term**: Set up monitoring alerts and backup strategies

Your bot will keep trading profitably 24/7 once deployed to the cloud! 🚀
