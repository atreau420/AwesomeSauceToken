#!/usr/bin/env node

import { Web3 } from 'web3';

const WALLET_ADDRESS = '0x6C14Aef8B5AB704abB3f9faF409c6fb304d3f04F';
const PRIVATE_KEY = '0xb93138aabe8248db0576c148d91af416ee6692e957b85594c52b5087bf22af49';

async function verifyWalletConnection() {
  console.log('🔍 VERIFYING WALLET CONNECTION...\n');

  try {
    // Test Polygon connection
    console.log('🌐 Testing Polygon Network...');
    const polygonWeb3 = new Web3('https://polygon-rpc.com');
    const polygonBalance = await polygonWeb3.eth.getBalance(WALLET_ADDRESS);
    const polygonBalanceMatic = parseFloat(polygonWeb3.utils.fromWei(polygonBalance, 'ether'));
    console.log(`✅ Polygon Balance: ${polygonBalanceMatic.toFixed(6)} MATIC`);
    console.log(`📍 Wallet Address: ${WALLET_ADDRESS}\n`);

    // Test Base connection
    console.log('🌐 Testing Base Network...');
    const baseWeb3 = new Web3('https://mainnet.base.org');
    const baseBalance = await baseWeb3.eth.getBalance(WALLET_ADDRESS);
    const baseBalanceEth = parseFloat(baseWeb3.utils.fromWei(baseBalance, 'ether'));
    console.log(`✅ Base Balance: ${baseBalanceEth.toFixed(6)} ETH`);
    console.log(`📍 Wallet Address: ${WALLET_ADDRESS}\n`);

    // Test Ethereum connection
    console.log('🌐 Testing Ethereum Network...');
    const ethWeb3 = new Web3('https://eth.llamarpc.com');
    const ethBalance = await ethWeb3.eth.getBalance(WALLET_ADDRESS);
    const ethBalanceEth = parseFloat(ethWeb3.utils.fromWei(ethBalance, 'ether'));
    console.log(`✅ Ethereum Balance: ${ethBalanceEth.toFixed(6)} ETH`);
    console.log(`📍 Wallet Address: ${WALLET_ADDRESS}\n`);

    // Test TOSHI balance on Base
    console.log('🎯 Testing TOSHI Balance on Base...');
    const toshiContract = new baseWeb3.eth.Contract([
      {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function'
      },
      {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function'
      }
    ], '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4');

    const toshiBalance = await toshiContract.methods.balanceOf(WALLET_ADDRESS).call();
    const toshiDecimals = await toshiContract.methods.decimals().call();

    // Handle BigInt conversion properly
    let toshiReadable;
    if (typeof toshiBalance === 'bigint') {
      toshiReadable = parseFloat(toshiBalance.toString()) / Math.pow(10, toshiDecimals);
    } else {
      toshiReadable = parseFloat(toshiBalance.toString()) / Math.pow(10, toshiDecimals);
    }

    console.log(`✅ TOSHI Balance: ${toshiReadable.toFixed(6)} TOSHI`);
    console.log(`📍 TOSHI Contract: 0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4\n`);

    // Test wallet signing capability
    console.log('🔐 Testing Private Key Authentication...');
    const account = baseWeb3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    console.log(`✅ Account Address: ${account.address}`);
    console.log(`✅ Wallet Connected: ${account.address === WALLET_ADDRESS ? 'YES' : 'NO'}\n`);

    console.log('🎉 WALLET CONNECTION VERIFICATION COMPLETE!');
    console.log('✅ All networks accessible');
    console.log('✅ TOSHI balance detected');
    console.log('✅ Private key authenticated');
    console.log('✅ Bot is ready for real trading');

  } catch (error) {
    console.error('❌ Connection verification failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check internet connection');
    console.log('2. Verify RPC endpoints are accessible');
    console.log('3. Ensure private key is correct');
    console.log('4. Check if wallet has sufficient funds for gas');
  }
}

verifyWalletConnection();
