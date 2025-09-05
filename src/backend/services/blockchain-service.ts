// Blockchain verification service for on-chain transaction validation
import { ethers } from 'ethers';

// Configure provider for mainnet/testnet
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/demo';
const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);

// Expected wallet address for payments
const PAYMENT_WALLET = process.env.PAYMENT_WALLET || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

export interface TransactionVerificationResult {
  valid: boolean;
  ethAmount: number;
  fromAddress: string;
  toAddress: string;
  blockNumber: number;
  timestamp: Date;
  error?: string;
}

/**
 * Verify an Ethereum transaction exists and matches expected criteria
 */
export async function verifyTransaction(txHash: string): Promise<TransactionVerificationResult> {
  try {
    // Validate transaction hash format
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return {
        valid: false,
        ethAmount: 0,
        fromAddress: '',
        toAddress: '',
        blockNumber: 0,
        timestamp: new Date(),
        error: 'Invalid transaction hash format'
      };
    }

    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return {
        valid: false,
        ethAmount: 0,
        fromAddress: '',
        toAddress: '',
        blockNumber: 0,
        timestamp: new Date(),
        error: 'Transaction not found'
      };
    }

    // Get transaction receipt to confirm it was mined
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        valid: false,
        ethAmount: 0,
        fromAddress: tx.from || '',
        toAddress: tx.to || '',
        blockNumber: 0,
        timestamp: new Date(),
        error: 'Transaction not yet mined or failed'
      };
    }

    // Check if transaction failed
    if (receipt.status === 0) {
      return {
        valid: false,
        ethAmount: 0,
        fromAddress: tx.from || '',
        toAddress: tx.to || '',
        blockNumber: receipt.blockNumber,
        timestamp: new Date(),
        error: 'Transaction failed on-chain'
      };
    }

    // Get block to get timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    const timestamp = block ? new Date(block.timestamp * 1000) : new Date();

    // Convert value from wei to ETH
    const ethAmount = parseFloat(ethers.formatEther(tx.value));

    // Verify transaction was sent to our payment wallet
    const toAddress = tx.to?.toLowerCase();
    const expectedAddress = PAYMENT_WALLET.toLowerCase();
    
    if (toAddress !== expectedAddress) {
      return {
        valid: false,
        ethAmount,
        fromAddress: tx.from || '',
        toAddress: tx.to || '',
        blockNumber: receipt.blockNumber,
        timestamp,
        error: `Transaction sent to wrong address. Expected ${PAYMENT_WALLET}, got ${tx.to}`
      };
    }

    // Minimum payment validation
    if (ethAmount < 0.001) {
      return {
        valid: false,
        ethAmount,
        fromAddress: tx.from || '',
        toAddress: tx.to || '',
        blockNumber: receipt.blockNumber,
        timestamp,
        error: 'Payment amount too small (minimum 0.001 ETH)'
      };
    }

    return {
      valid: true,
      ethAmount,
      fromAddress: tx.from || '',
      toAddress: tx.to || '',
      blockNumber: receipt.blockNumber,
      timestamp
    };

  } catch (error) {
    console.error('Blockchain verification error:', error);
    return {
      valid: false,
      ethAmount: 0,
      fromAddress: '',
      toAddress: '',
      blockNumber: 0,
      timestamp: new Date(),
      error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check if a transaction hash has already been processed
 */
export function isTransactionProcessed(txHash: string, processedTxs: Set<string>): boolean {
  return processedTxs.has(txHash.toLowerCase());
}

/**
 * Estimate gas cost for a transaction
 */
export async function estimateGasCost(): Promise<{ gasPrice: string; gasCostETH: string }> {
  try {
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const estimatedGas = 21000; // Standard ETH transfer gas limit
    const gasCost = gasPrice * BigInt(estimatedGas);
    
    return {
      gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
      gasCostETH: ethers.formatEther(gasCost) + ' ETH'
    };
  } catch (error) {
    return {
      gasPrice: '20 gwei',
      gasCostETH: '0.00042 ETH'
    };
  }
}

/**
 * Get current ETH price from a simple API
 */
export async function getCurrentETHPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum?.usd || 0;
  } catch {
    return 0; // Fallback if API fails
  }
}