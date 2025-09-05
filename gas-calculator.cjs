#!/usr/bin/env node

/**
 * Gas Cost Calculator
 * Shows current gas prices and costs for micro-transactions
 */

const { Web3 } = require('web3');
require('dotenv').config();

const CONFIG = {
    RPC_URL: process.env.RPC_URL || 'https://polygon-rpc.com',
    WALLET_ADDRESS: process.env.WALLET_ADDRESS
};

async function calculateGasCosts() {
    console.log('⛽ GAS COST CALCULATOR\n');

    const web3 = new Web3(CONFIG.RPC_URL);

    try {
        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        const gasPriceGwei = web3.utils.fromWei(gasPrice.toString(), 'gwei');
        const gasPriceEth = web3.utils.fromWei(gasPrice.toString(), 'ether');

        console.log(`Current Gas Price: ${gasPriceGwei} gwei (${gasPriceEth} ETH per gas unit)`);

        // Calculate costs for different transaction types
        const gasLimits = {
            'Simple Transfer': 21000,
            'ERC-20 Transfer': 65000,
            'Uniswap Swap': 150000
        };

        console.log('\n📊 Transaction Costs:');
        for (const [type, gasLimit] of Object.entries(gasLimits)) {
            const costWei = BigInt(gasPrice) * BigInt(gasLimit);
            const costEth = web3.utils.fromWei(costWei.toString(), 'ether');
            const costUsd = (parseFloat(costEth) * 0.8).toFixed(4); // Rough MATIC price
            console.log(`${type}: ${costEth} MATIC ($${costUsd} USD)`);
        }

        // Check wallet balance
        if (CONFIG.WALLET_ADDRESS) {
            const balance = await web3.eth.getBalance(CONFIG.WALLET_ADDRESS);
            const balanceEth = web3.utils.fromWei(balance, 'ether');
            const balanceUsd = (parseFloat(balanceEth) * 0.8).toFixed(4);

            console.log(`\n💰 Your Balance: ${balanceEth} MATIC ($${balanceUsd} USD)`);

            // Check if enough for micro-transaction
            const microTxCost = BigInt(gasPrice) * BigInt(21000) + web3.utils.toWei('0.0000001', 'wei');
            const microTxCostMatic = web3.utils.fromWei(microTxCost.toString(), 'ether');

            console.log(`\n🎯 Micro-transaction (0.0000001 MATIC + gas): ${microTxCostMatic} MATIC`);

            if (parseFloat(balanceEth) >= parseFloat(microTxCostMatic) * 1.1) {
                console.log('✅ You have enough for micro-transactions!');
            } else {
                console.log('❌ Insufficient balance for micro-transactions');
                console.log(`   Need: ${(parseFloat(microTxCostMatic) * 1.1).toFixed(10)} MATIC`);
                console.log(`   Have: ${balanceEth} MATIC`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

calculateGasCosts();
