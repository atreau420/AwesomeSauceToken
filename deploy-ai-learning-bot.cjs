#!/usr/bin/env node

/**
 * AI LEARNING BOT DEPLOYMENT SCRIPT
 * Launches the AI Learning Trading Bot and Monitor together
 */

const { spawn } = require('child_process');
const fs = require('fs');

class AIDeploymentManager {
    constructor() {
        this.botProcess = null;
        this.monitorProcess = null;
        this.isRunning = false;
    }

    async start() {
        console.log('🚀 Starting AI LEARNING BOT DEPLOYMENT...');
        console.log('🧠 AI Learning: ACTIVE');
        console.log('📊 Real-time Monitoring: ACTIVE');
        console.log('🎯 Adaptive Strategies: ACTIVE');

        this.isRunning = true;

        // Check if required files exist
        if (!fs.existsSync('ai-learning-bot.cjs')) {
            console.error('❌ ai-learning-bot.cjs not found!');
            return;
        }

        if (!fs.existsSync('ai-learning-monitor.cjs')) {
            console.error('❌ ai-learning-monitor.cjs not found!');
            return;
        }

        // Check environment variables
        if (!process.env.PRIVATE_KEY || !process.env.WALLET_ADDRESS) {
            console.error('❌ Please configure PRIVATE_KEY and WALLET_ADDRESS in .env');
            return;
        }

        console.log('✅ All checks passed, launching AI system...');

        // Start the monitor first
        console.log('📊 Starting AI Learning Monitor...');
        this.monitorProcess = spawn('node', ['ai-learning-monitor.cjs'], {
            stdio: 'inherit',
            detached: false
        });

        this.monitorProcess.on('error', (error) => {
            console.error('❌ Monitor process error:', error);
        });

        this.monitorProcess.on('exit', (code) => {
            console.log(`📊 Monitor process exited with code ${code}`);
        });

        // Wait a moment for monitor to initialize
        await this.sleep(3000);

        // Start the AI bot
        console.log('🤖 Starting AI Learning Trading Bot...');
        this.botProcess = spawn('node', ['ai-learning-bot.cjs'], {
            stdio: 'inherit',
            detached: false
        });

        this.botProcess.on('error', (error) => {
            console.error('❌ Bot process error:', error);
        });

        this.botProcess.on('exit', (code) => {
            console.log(`🤖 Bot process exited with code ${code}`);
        });

        console.log('✅ AI LEARNING SYSTEM DEPLOYED!');
        console.log('🎯 The AI will now:');
        console.log('   • Analyze market conditions every 5 minutes');
        console.log('   • Learn from successful and failed trades');
        console.log('   • Adapt strategies based on performance');
        console.log('   • Monitor real-time performance');
        console.log('   • Pursue maximum profits intelligently');
        console.log('');
        console.log('⚠️  WARNING: This system trades real cryptocurrencies!');
        console.log('🛑 Press Ctrl+C to stop the system');

        // Keep the deployment manager running
        while (this.isRunning) {
            await this.sleep(10000);

            // Check if processes are still running
            if (this.botProcess && this.botProcess.exitCode !== null) {
                console.log('⚠️  AI Bot process has stopped, restarting...');
                this.restartBot();
            }

            if (this.monitorProcess && this.monitorProcess.exitCode !== null) {
                console.log('⚠️  Monitor process has stopped, restarting...');
                this.restartMonitor();
            }
        }
    }

    restartBot() {
        console.log('🔄 Restarting AI Learning Bot...');
        this.botProcess = spawn('node', ['ai-learning-bot.cjs'], {
            stdio: 'inherit',
            detached: false
        });

        this.botProcess.on('error', (error) => {
            console.error('❌ Bot restart error:', error);
        });
    }

    restartMonitor() {
        console.log('🔄 Restarting AI Learning Monitor...');
        this.monitorProcess = spawn('node', ['ai-learning-monitor.cjs'], {
            stdio: 'inherit',
            detached: false
        });

        this.monitorProcess.on('error', (error) => {
            console.error('❌ Monitor restart error:', error);
        });
    }

    async stop() {
        console.log('🛑 Stopping AI Learning System...');
        this.isRunning = false;

        if (this.botProcess) {
            this.botProcess.kill();
            console.log('🤖 AI Bot stopped');
        }

        if (this.monitorProcess) {
            this.monitorProcess.kill();
            console.log('📊 Monitor stopped');
        }

        console.log('✅ AI Learning System shutdown complete');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    const manager = new AIDeploymentManager();
    await manager.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal...');
    const manager = new AIDeploymentManager();
    await manager.stop();
    process.exit(0);
});

// Start the deployment
async function startDeployment() {
    try {
        const manager = new AIDeploymentManager();
        await manager.start();
    } catch (error) {
        console.error('❌ Failed to start AI deployment:', error.message);
        process.exit(1);
    }
}

startDeployment();
