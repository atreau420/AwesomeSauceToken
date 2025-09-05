# 🤖 AI Learning Trading Bot

An intelligent, self-learning cryptocurrency trading bot that adapts its strategies based on market conditions and performance data to maximize profits.

## 🎯 Features

- **🧠 Machine Learning**: Learns from successful and failed trades
- **📊 Market Analysis**: Analyzes gas prices, network congestion, and currency tendencies
- **🎯 Adaptive Strategies**: Dynamically adjusts trading parameters based on performance
- **⚡ Real-time Monitoring**: Live performance tracking and analytics
- **🔄 Auto-restart**: Automatically restarts crashed processes
- **💰 Profit Optimization**: Focuses on profitable trades only
- **⛽ Gas Efficiency**: Adapts to gas price changes for optimal execution

## 🚀 Quick Start

### Prerequisites
- Node.js installed
- Polygon wallet with MATIC
- Environment variables configured

### 1. Configure Environment
Create a `.env` file with your wallet credentials:
```bash
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=your_wallet_address_here
RPC_URL=https://polygon-rpc.com
```

### 2. Install Dependencies
```bash
npm install web3 dotenv
```

### 3. Launch the AI System
```bash
node deploy-ai-learning-bot.cjs
```

This will start both the AI trading bot and the real-time monitor.

## 🧠 How the AI Works

### Learning Process
1. **Market Analysis**: Every 5 minutes, analyzes gas prices and network conditions
2. **Performance Tracking**: Records every trade result (profit/loss)
3. **Strategy Adaptation**: Adjusts parameters based on success rates
4. **Currency Tendencies**: Learns from different market conditions

### Adaptive Parameters
The AI dynamically adjusts:
- **Trade Size**: Based on gas efficiency and success rate
- **Profit Thresholds**: Lowers requirements when performing well
- **Trading Frequency**: Increases during good market conditions
- **Risk Levels**: Becomes more conservative after losses

### Strategy Types
- **Conservative Arbitrage**: Safe, low-risk trades
- **Momentum Trading**: Capitalizes on price movements
- **Scalping**: Small, frequent trades during low gas
- **Mean Reversion**: Trades against temporary price deviations

## 📊 Monitoring

The system provides real-time monitoring including:
- Current balance and profit/loss
- Win rate and success statistics
- Gas efficiency metrics
- AI confidence levels
- Performance trends
- Trading recommendations

## ⚙️ Configuration

Edit `ai-config.json` to customize:
- Learning parameters
- Trading thresholds
- Risk management
- Strategy weights
- Performance targets

## 🛑 Safety Features

- **Emergency Stop Loss**: Stops trading if losses exceed threshold
- **Gas Reserve**: Always maintains gas for transactions
- **Consecutive Loss Protection**: Adapts strategy after multiple failures
- **Balance Protection**: Never trades more than available balance

## 📈 Performance Goals

- **Target Win Rate**: 60%+
- **Profit Factor**: 1.5+
- **Gas Efficiency**: <20% of profits
- **Maximum Drawdown**: <20%

## 🔧 Manual Control

### Start Individual Components
```bash
# Start only the AI bot
node ai-learning-bot.cjs

# Start only the monitor
node ai-learning-monitor.cjs
```

### Stop the System
Press `Ctrl+C` in the terminal running the deployment script.

## 📋 Files Overview

- `ai-learning-bot.cjs` - Main AI trading bot
- `ai-learning-monitor.cjs` - Real-time performance monitor
- `deploy-ai-learning-bot.cjs` - Deployment manager
- `ai-config.json` - AI configuration parameters
- `ai_learning_data.json` - Learning data (auto-generated)

## ⚠️ Important Warnings

1. **Real Money Trading**: This bot trades real cryptocurrencies
2. **Risk of Loss**: All trading involves risk, including total loss
3. **Test First**: Test with small amounts before scaling up
4. **Monitor Regularly**: Keep an eye on performance and intervene if needed
5. **Gas Costs**: Polygon gas fees can be significant during high network activity

## 🎯 Optimization Tips

1. **Start Small**: Begin with small trade sizes to test strategies
2. **Monitor Gas**: Trade during low gas periods for better efficiency
3. **Let AI Learn**: Allow time for the AI to learn and adapt
4. **Regular Check-ins**: Review performance weekly and adjust config if needed
5. **Emergency Funds**: Keep emergency MATIC for gas fees

## 🆘 Troubleshooting

### Bot Not Starting
- Check `.env` file has correct credentials
- Ensure Node.js is installed
- Verify wallet has sufficient MATIC for gas

### Poor Performance
- Check gas prices (trade during low gas periods)
- Review AI learning data for patterns
- Adjust configuration parameters
- Consider market conditions

### High Gas Costs
- The AI automatically adapts to gas prices
- Consider trading during off-peak hours
- Increase minimum profit thresholds

## 📞 Support

Monitor the console output for real-time status and error messages. The AI will automatically adapt and provide recommendations based on performance.

---

**Remember**: This is an experimental AI system. Use at your own risk and never trade more than you can afford to lose.
