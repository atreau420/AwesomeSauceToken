#!/usr/bin/env node

/**
 * Wallet Token Scanner for Maximum Profit Bot
 * Scans user's wallet for all tokens and displays them
 */

const { Web3 } = require('web3');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const CONFIG = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    RPC_URL: process.env.RPC_URL || 'https://ethereum.publicnode.com'
};

async function scanWalletTokens() {
    console.log('🔍 Scanning wallet for all tokens...');
    console.log('=====================================');

    if (!CONFIG.PRIVATE_KEY || !CONFIG.WALLET_ADDRESS) {
        console.error('❌ Missing wallet credentials in .env file');
        process.exit(1);
    }

    const web3 = new Web3(CONFIG.RPC_URL);

    try {
        // Check ETH balance
        const ethBalance = await web3.eth.getBalance(CONFIG.WALLET_ADDRESS);
        const ethBalanceFormatted = web3.utils.fromWei(ethBalance, 'ether');

        console.log(`💰 ETH Balance: ${ethBalanceFormatted} ETH`);
        console.log('');

        // Common ERC-20 tokens to check
        const commonTokens = [
            { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
            { symbol: 'USDC', address: '0xA0b86a33E6441e88C5F2712C3E9b74F5b8b6b8b8', decimals: 6 },
            { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
            { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
            { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
            { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18 },
            { symbol: 'COMP', address: '0xc00e94Cb662C3520282E6f5717214004A7f26888', decimals: 18 },
            { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', decimals: 18 },
            { symbol: 'YFI', address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', decimals: 18 },
            { symbol: 'SUSHI', address: '0x6B3595068778DD592e39A122f4f5a5CF09C90fE2', decimals: 18 },
            { symbol: 'CRV', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', decimals: 18 },
            { symbol: 'BAL', address: '0xba100000625a3754423978a60c9317c58a5Ee5FF', decimals: 18 }
        ];

        let foundTokens = 0;

        for (const token of commonTokens) {
            try {
                // ERC-20 balanceOf function call
                const contract = new web3.eth.Contract([
                    {
                        constant: true,
                        inputs: [{ name: '_owner', type: 'address' }],
                        name: 'balanceOf',
                        outputs: [{ name: 'balance', type: 'uint256' }],
                        type: 'function'
                    }
                ], token.address);

                const balance = await contract.methods.balanceOf(CONFIG.WALLET_ADDRESS).call();

                if (parseFloat(balance) > 0) {
                    const balanceFormatted = (parseFloat(balance) / Math.pow(10, token.decimals)).toFixed(6);
                    console.log(`💎 ${token.symbol}: ${balanceFormatted}`);
                    foundTokens++;
                }
            } catch (error) {
                // Token not found or error, skip silently
                continue;
            }
        }

        console.log('');
        console.log(`✅ Scan complete! Found ${foundTokens} ERC-20 tokens in your wallet`);
        console.log('');
        console.log('🚀 The bot will now trade ANY of these tokens for maximum profit!');
        console.log('💡 Even fractions of pennies add up with high-frequency trading');

    } catch (error) {
        console.error('❌ Error scanning wallet:', error.message);
        process.exit(1);
    }
}

// Run the scanner
scanWalletTokens();
