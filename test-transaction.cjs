#!/usr/bin/env node

/**
 * Test script to verify the bot can execute real transactions
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

async function testTransaction() {
    console.log('🧪 Testing real blockchain transaction...');

    if (!CONFIG.PRIVATE_KEY || !CONFIG.WALLET_ADDRESS) {
        console.error('❌ Missing wallet credentials');
        process.exit(1);
    }

    const web3 = new Web3(CONFIG.RPC_URL);

    try {
        // Check balance
        const balance = await web3.eth.getBalance(CONFIG.WALLET_ADDRESS);
        const balanceInEth = web3.utils.fromWei(balance, 'ether');
        console.log(`💰 Current Balance: ${balanceInEth} ETH`);

        // Check gas price
        const gasPrice = await web3.eth.getGasPrice();
        const gasPriceGwei = web3.utils.fromWei(gasPrice.toString(), 'gwei');
        console.log(`⛽ Gas Price: ${gasPriceGwei} gwei`);

        // Calculate gas cost
        const gasCost = web3.utils.fromWei((BigInt(gasPrice) * BigInt(21000)).toString(), 'ether');
        console.log(`💸 Gas Cost for transfer: ${gasCost} ETH`);

        // Test transaction amount
        const testAmount = '0.0000001'; // Very small amount
        const totalCost = parseFloat(testAmount) + parseFloat(gasCost);

        console.log(`📤 Test Amount: ${testAmount} ETH`);
        console.log(`📊 Total Cost: ${totalCost} ETH`);

        if (parseFloat(balanceInEth) < totalCost * 1.1) {
            console.log(`❌ Insufficient balance for test transaction`);
            console.log(`📊 Need: ${totalCost * 1.1} ETH`);
            console.log(`📊 Have: ${balanceInEth} ETH`);
            return;
        }

        // Create test transaction
        const tx = {
            from: CONFIG.WALLET_ADDRESS,
            to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // Test address
            value: web3.utils.toWei(testAmount, 'ether'),
            gas: 21000,
            gasPrice: gasPrice.toString()
        };

        console.log('🔐 Signing transaction...');
        const signedTx = await web3.eth.accounts.signTransaction(tx, CONFIG.PRIVATE_KEY);

        console.log('📡 Sending to blockchain...');
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log('✅ SUCCESS! Transaction sent!');
        console.log(`🔗 TX Hash: ${receipt.transactionHash}`);
        console.log(`📊 Block: ${receipt.blockNumber}`);
        console.log('🎯 This should appear in Coinbase Wallet!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testTransaction();
