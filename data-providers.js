// External data provider stubs with graceful fallback.
// Real implementations can plug in Coingecko, DEX volume APIs, gas trackers.
import axios from 'axios';

async function safeGet(url, opts = {}) {
  try { const r = await axios.get(url, { timeout: opts.timeout || 4000 }); return r.data; } catch { return null; }
}

export async function fetchPriceMomentum(symbol = 'ETH', opts = {}) {
  // Placeholder: simulate momentum [-1,1] using jitter; real impl fetch historical prices.
  const base = Math.sin(Date.now() / 600000); // slow oscillation
  const noise = (Math.random() - 0.5) * 0.3;
  return Math.max(-1, Math.min(1, base + noise));
}

export async function fetchDexVolume(chain = 'ethereum', opts = {}) {
  // Placeholder: pseudo volume in millions USD
  return { chain, volume24h: 50 + Math.random() * 200 };
}

export async function fetchGasOracle(chain = 'ethereum', opts = {}) {
  // Placeholder: mimic gas tiers in gwei
  const base = 20 + Math.random() * 40; // 20-60
  return { chain, base, priority: base * 1.15, timestamp: Date.now() };
}

export default { fetchPriceMomentum, fetchDexVolume, fetchGasOracle };
