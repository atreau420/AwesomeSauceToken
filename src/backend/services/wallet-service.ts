import { Web3 } from 'web3';
import crypto from 'crypto';

const web3 = new Web3(process.env.RPC_URL || 'https://polygon-rpc.com');

interface WalletSession {
  id: string;
  address: string;
  connectedAt: Date;
  lastActivity: Date;
  balance?: number;
}

const sessions = new Map<string, WalletSession>();

export async function connectWallet(address: string) {
  if (!address) throw new Error('Address required');
  const now = new Date();
  const existing = sessions.get(address.toLowerCase());
  if (existing) {
    existing.lastActivity = now;
    return existing;
  }
  const session: WalletSession = {
    id: crypto.randomUUID(),
    address: address.toLowerCase(),
    connectedAt: now,
    lastActivity: now
  };
  sessions.set(address.toLowerCase(), session);
  return session;
}

export async function getWalletBalance(address: string) {
  if (!address) throw new Error('Address required');
  const wei = await web3.eth.getBalance(address);
  const eth = parseFloat(web3.utils.fromWei(wei, 'ether'));
  return { address, balance: eth };
}

export function getSession(address: string) {
  return sessions.get(address.toLowerCase());
}
