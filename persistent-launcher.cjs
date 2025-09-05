#!/usr/bin/env node

/**
 * PERSISTENT TRADING BOT LAUNCHER
 * Keeps the bot running 24/7 with auto-restart
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class PersistentBotLauncher {
    constructor() {
        this.botProcess = null;
        this.monitorProcess = null;
        this.restartCount = 0;
        this.maxRestarts = 10;
        this.startTime = Date.now();
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }

    startBot() {
        this.log('🚀 Starting Conservative Trading Bot...');

        this.botProcess = spawn('node', ['conservative-trading-bot.cjs'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false
        });

        this.botProcess.stdout.on('data', (data) => {
            console.log(`🤖 BOT: ${data.toString().trim()}`);
        });

        this.botProcess.stderr.on('data', (data) => {
            console.log(`⚠️ BOT ERROR: ${data.toString().trim()}`);
        });

        this.botProcess.on('close', (code) => {
            this.log(`❌ Bot process exited with code ${code}`);
            this.handleBotCrash();
        });

        this.botProcess.on('error', (error) => {
            this.log(`💥 Bot process error: ${error.message}`);
            this.handleBotCrash();
        });
    }

    startMonitor() {
        this.log('📊 Starting Profit Monitor...');

        this.monitorProcess = spawn('node', ['profit-monitor.cjs'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false
        });

        this.monitorProcess.stdout.on('data', (data) => {
            console.log(`📈 MONITOR: ${data.toString().trim()}`);
        });

        this.monitorProcess.stderr.on('data', (data) => {
            console.log(`⚠️ MONITOR ERROR: ${data.toString().trim()}`);
        });

        this.monitorProcess.on('close', (code) => {
            this.log(`❌ Monitor process exited with code ${code}`);
            this.restartMonitor();
        });
    }

    handleBotCrash() {
        if (this.restartCount < this.maxRestarts) {
            this.restartCount++;
            this.log(`🔄 Restarting bot (attempt ${this.restartCount}/${this.maxRestarts})...`);

            setTimeout(() => {
                this.startBot();
            }, 5000); // Wait 5 seconds before restart
        } else {
            this.log('🚫 Max restart attempts reached. Manual intervention required.');
            this.log('💡 To restart: Run "node persistent-launcher.cjs" again');
        }
    }

    restartMonitor() {
        this.log('🔄 Restarting monitor...');
        setTimeout(() => {
            this.startMonitor();
        }, 2000);
    }

    stop() {
        this.log('🛑 Stopping all processes...');

        if (this.botProcess) {
            this.botProcess.kill('SIGTERM');
        }

        if (this.monitorProcess) {
            this.monitorProcess.kill('SIGTERM');
        }

        setTimeout(() => {
            process.exit(0);
        }, 2000);
    }

    getStatus() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        this.log(`📊 Status Report:`);
        this.log(`⏰ Uptime: ${hours}h ${minutes}m`);
        this.log(`🔄 Bot Restarts: ${this.restartCount}`);
        this.log(`🤖 Bot Process: ${this.botProcess ? 'Running' : 'Stopped'}`);
        this.log(`📊 Monitor Process: ${this.monitorProcess ? 'Running' : 'Stopped'}`);
    }

    start() {
        this.log('🎯 Starting Persistent Trading Bot System...');
        this.log('💡 Press Ctrl+C to stop gracefully');

        // Start both processes
        this.startBot();
        this.startMonitor();

        // Status updates every 5 minutes
        setInterval(() => {
            this.getStatus();
        }, 300000);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            this.log('📴 Received shutdown signal...');
            this.stop();
        });

        process.on('SIGTERM', () => {
            this.log('📴 Received termination signal...');
            this.stop();
        });

        // Initial status
        setTimeout(() => {
            this.getStatus();
        }, 3000);
    }
}

// Start the persistent launcher
const launcher = new PersistentBotLauncher();
launcher.start();
