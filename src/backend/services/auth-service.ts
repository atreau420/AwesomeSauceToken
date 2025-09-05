import { randomBytes } from 'crypto';
import { ethers } from 'ethers';

interface Session { address: string; token: string; createdAt: number; }

const nonces = new Map<string, string>(); // address -> nonce
const sessions = new Map<string, Session>(); // token -> session

export function requestNonce(address: string) {
  if (!address) throw new Error('address required');
  const nonce = 'Sign to authenticate: ' + randomBytes(16).toString('hex');
  nonces.set(address.toLowerCase(), nonce);
  return { address: address.toLowerCase(), nonce };
}

export function verifySignature(address: string, signature: string) {
  if (!address || !signature) throw new Error('address & signature required');
  const key = address.toLowerCase();
  const nonce = nonces.get(key);
  if (!nonce) throw new Error('No nonce for address');
  const recovered = ethers.verifyMessage(nonce, signature).toLowerCase();
  if (recovered !== key) throw new Error('Signature mismatch');
  nonces.delete(key);
  const token = randomBytes(24).toString('hex');
  const session: Session = { address: key, token, createdAt: Date.now() };
  sessions.set(token, session);
  return { token, address: key };
}

export function getSession(token: string): Session | null {
  const s = sessions.get(token);
  if (!s) return null;
  // 24h expiry
  if (Date.now() - s.createdAt > 24 * 60 * 60 * 1000) { sessions.delete(token); return null; }
  return s;
}
