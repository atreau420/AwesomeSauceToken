#!/usr/bin/env node

/**
 * Independent Trading Bot Monitor
 * Real-time monitoring dashboard for the trading bot
 */

const fs = require('fs');
const path = require('path');

class BotMonitor {
    constructor() {
        this.logFile = path.join(__dirname, 'trading_bot.log');
        this.performanceFile = path.join(__dirname, 'performance.log');
        this.isMonitoring = false;
    }

    start() {
        console.clear();
        console.log('🤖 AwesomeSauceToken Trading Bot Monitor');
        console.log('==========================================');
        console.log('');

        this.isMonitoring = true;
        this.displayDashboard();

        // Update every 5 seconds
        setInterval(() => {
            if (this.isMonitoring) {
                console.clear();
                this.displayDashboard();
            }
        }, 5000);
    }

    stop() {
        this.isMonitoring = false;
        console.log('📊 Monitor stopped');
    }

    displayDashboard() {
        console.log('🤖 AwesomeSauceToken Trading Bot Monitor');
        console.log('==========================================');
        console.log('');

        // System Status
        this.displaySystemStatus();

        // Performance Metrics
        this.displayPerformanceMetrics();

        // Recent Trades
        this.displayRecentTrades();

        // Risk Metrics
        this.displayRiskMetrics();

        console.log('');
        console.log('🔄 Refreshing every 5 seconds... (Ctrl+C to exit)');
    }

    displaySystemStatus() {
        console.log('📊 SYSTEM STATUS');
        console.log('----------------');

        try {
            const stats = fs.statSync(this.logFile);
            const lastModified = new Date(stats.mtime);
            const timeSince = Math.floor((Date.now() - lastModified.getTime()) / 1000);

            if (timeSince < 60) {
                console.log(`🟢 Bot Status: ACTIVE (${timeSince}s ago)`);
            } else if (timeSince < 300) {
                console.log(`🟡 Bot Status: IDLE (${Math.floor(timeSince/60)}m ago)`);
            } else {
                console.log(`🔴 Bot Status: INACTIVE (${Math.floor(timeSince/60)}m ago)`);
            }
        } catch (error) {
            console.log('🔴 Bot Status: NO LOG FILE FOUND');
        }

        console.log('');
    }

    displayPerformanceMetrics() {
        console.log('💰 PERFORMANCE METRICS');
        console.log('----------------------');

        try {
            const performanceData = fs.readFileSync(this.performanceFile, 'utf8');
            const lines = performanceData.trim().split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                console.log('📊 No performance data yet');
                console.log('');
                return;
            }

            // Calculate metrics
            let totalTrades = 0;
            let winningTrades = 0;
            let totalProfit = 0;
            let totalLoss = 0;

            lines.forEach(line => {
                if (line.includes('Profit:')) {
                    totalTrades++;
                    const profitMatch = line.match(/Profit:\s*\$([0-9.-]+)/);
                    if (profitMatch) {
                        const profit = parseFloat(profitMatch[1]);
                        if (profit > 0) {
                            winningTrades++;
                            totalProfit += profit;
                        } else {
                            totalLoss += Math.abs(profit);
                        }
                    }
                }
            });

            const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0;
            const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : 'N/A';
            const netProfit = (totalProfit - totalLoss).toFixed(4);

            console.log(`📈 Total Trades: ${totalTrades}`);
            console.log(`🎯 Win Rate: ${winRate}%`);
            console.log(`💰 Net Profit: $${netProfit}`);
            console.log(`📊 Profit Factor: ${profitFactor}`);
            console.log(`🟢 Winning Trades: ${winningTrades}`);
            console.log(`🔴 Losing Trades: ${totalTrades - winningTrades}`);

        } catch (error) {
            console.log('📊 No performance data available yet');
        }

        console.log('');
    }

    displayRecentTrades() {
        console.log('🔄 RECENT TRADES');
        console.log('-----------------');

        try {
            const logData = fs.readFileSync(this.logFile, 'utf8');
            const lines = logData.trim().split('\n').filter(line => line.trim());

            // Get last 5 trade-related lines
            const tradeLines = lines
                .filter(line => line.includes('BUY:') || line.includes('SELL:'))
                .slice(-5);

            if (tradeLines.length === 0) {
                console.log('📊 No trades recorded yet');
            } else {
                tradeLines.forEach((line, index) => {
                    const timestamp = line.match(/\[([^\]]+)\]/)?.[1] || '';
                    const tradeInfo = line.split('] ')[1] || line;
                    console.log(`${index + 1}. ${tradeInfo}`);
                });
            }

        } catch (error) {
            console.log('📊 No trade data available');
        }

        console.log('');
    }

    displayRiskMetrics() {
        console.log('⚠️  RISK METRICS');
        console.log('---------------');

        try {
            const logData = fs.readFileSync(this.logFile, 'utf8');
            const lines = logData.trim().split('\n').filter(line => line.trim());

            // Check for error messages
            const errors = lines.filter(line =>
                line.includes('ERROR') ||
                line.includes('FAILED') ||
                line.includes('Daily loss limit reached')
            );

            if (errors.length > 0) {
                console.log(`🚨 Recent Errors: ${errors.length}`);
                errors.slice(-3).forEach(error => {
                    const errorMsg = error.split('] ')[1] || error;
                    console.log(`   • ${errorMsg.substring(0, 60)}...`);
                });
            } else {
                console.log('✅ No recent errors detected');
            }

            // Check for stop loss triggers
            const stopLosses = lines.filter(line => line.includes('stop loss') || line.includes('Stop Loss'));
            if (stopLosses.length > 0) {
                console.log(`🛑 Stop Losses Triggered: ${stopLosses.length}`);
            }

        } catch (error) {
            console.log('📊 Unable to read risk data');
        }

        console.log('');
    }

    getSummary() {
        try {
            const performanceData = fs.readFileSync(this.performanceFile, 'utf8');
            const lines = performanceData.trim().split('\n').filter(line => line.trim());

            let totalTrades = 0;
            let totalProfit = 0;
            let totalLoss = 0;

            lines.forEach(line => {
                if (line.includes('Profit:')) {
                    totalTrades++;
                    const profitMatch = line.match(/Profit:\s*\$([0-9.-]+)/);
                    if (profitMatch) {
                        const profit = parseFloat(profitMatch[1]);
                        if (profit > 0) {
                            totalProfit += profit;
                        } else {
                            totalLoss += Math.abs(profit);
                        }
                    }
                }
            });

            return {
                totalTrades,
                netProfit: totalProfit - totalLoss,
                winRate: totalTrades > 0 ? ((totalProfit / (totalProfit + totalLoss)) * 100) : 0
            };

        } catch (error) {
            return { totalTrades: 0, netProfit: 0, winRate: 0 };
        }
    }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--summary') || args.includes('-s')) {
    // Show summary only
    const monitor = new BotMonitor();
    const summary = monitor.getSummary();
    console.log('📊 Trading Bot Summary:');
    console.log(`   Total Trades: ${summary.totalTrades}`);
    console.log(`   Net Profit: $${summary.netProfit.toFixed(4)}`);
    console.log(`   Win Rate: ${summary.winRate.toFixed(1)}%`);
} else {
    // Start monitoring dashboard
    const monitor = new BotMonitor();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n📊 Stopping monitor...');
        monitor.stop();
        process.exit(0);
    });

    monitor.start();
}

module.exports = { BotMonitor };
