import { Web3 } from 'web3';

console.log('🔐 Testing private key and blockchain connection...');

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com/';

if (!privateKey || privateKey === 'your-private-key-here') {
    console.log('❌ Private key not configured');
    process.exit(1);
}

console.log('✅ Private key configured');
console.log('🌐 Connecting to Polygon...');

const web3 = new Web3(rpcUrl);
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

console.log('📱 Wallet address:', account.address);

async function testConnection() {
    try {
        const balance = await web3.eth.getBalance(account.address);
        const balanceInEth = web3.utils.fromWei(balance, 'ether');
        console.log('💰 MATIC Balance:', balanceInEth);

        const blockNumber = await web3.eth.getBlockNumber();
        console.log('📊 Current block:', blockNumber);

        console.log('✅ Blockchain connection successful!');
        console.log('🚀 Bot can now execute real transactions');

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();
