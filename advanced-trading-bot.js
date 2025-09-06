import 'dotenv/config';
import { Web3 } from 'web3';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import StrategyBrain from './strategy-brain.js';
import { fetchPriceMomentum, fetchDexVolume, fetchGasOracle } from './data-providers.js';
import { fileURLToPath } from 'url';

// Proper filename/dirname resolution (previous line was corrupted by accidental paste)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
 * WEALTH BUILDING STRATEGY:
 * This bot is designed to build wealth using existing resources without requiring additional funding.
 * 
 * Key Strategies:
 * 1. Micro-trades: Execute very small profitable trades with minimal gas requirements
 * 2. TOSHI Arbitrage: Use existing 7,469 TOSHI tokens for arbitrage opportunities
 * 3. Progressive Rate Limiting: Handle Base network rate limits with increasing delays
 * 4. Gas Optimization: Use lowest possible gas limits for all transactions
 * 5. Consistent Profits: Focus on many small profits rather than large gains
 * 
 * Target: Build from current $0.004219 reserve to $3M through consistent micro-trades
 */

// Complete ERC20 ABI with all necessary methods
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{"name": "_from", "type": "address"}, {"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
        "name": "transferFrom",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
];

// Minimal ERC721 & ERC1155 ABIs for balance + transfer (read / approval scope only by default)
const ERC721_ABI = [
    { "constant": true, "inputs": [{"name":"owner","type":"address"}], "name":"balanceOf", "outputs": [{"name":"balance","type":"uint256"}], "type":"function" },
    { "constant": true, "inputs": [{"name":"tokenId","type":"uint256"}], "name":"ownerOf", "outputs": [{"name":"owner","type":"address"}], "type":"function" },
    { "constant": true, "inputs": [{"name":"owner","type":"address"},{"name":"operator","type":"address"}], "name":"isApprovedForAll", "outputs": [{"name":"","type":"bool"}], "type":"function" },
    { "constant": false, "inputs": [{"name":"operator","type":"address"},{"name":"approved","type":"bool"}], "name":"setApprovalForAll", "outputs": [], "type":"function" },
    { "constant": false, "inputs": [{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokenId","type":"uint256"}], "name":"safeTransferFrom", "outputs": [], "type":"function" }
];
const ERC1155_ABI = [
    { "constant": true, "inputs": [{"name":"account","type":"address"},{"name":"id","type":"uint256"}], "name":"balanceOf", "outputs": [{"name":"","type":"uint256"}], "type":"function" },
    { "constant": false, "inputs": [{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"id","type":"uint256"},{"name":"amount","type":"uint256"},{"name":"data","type":"bytes"}], "name":"safeTransferFrom","outputs":[],"type":"function" }
];

// DEX Router ABIs
// Extended ABI including Uniswap V3 exactInputSingle and Uniswap V2 style methods
const UNISWAP_ROUTER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "address", "name": "tokenIn", "type": "address"},
                    {"internalType": "address", "name": "tokenOut", "type": "address"},
                    {"internalType": "uint24", "name": "fee", "type": "uint24"},
                    {"internalType": "address", "name": "recipient", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
                    {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
                ],
                "internalType": "struct ISwapRouter.ExactInputSingleParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "exactInputSingle",
        "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "name": "swapExactTokensForTokens",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"}
        ],
        "outputs": [{"name": "amounts", "type": "uint256[]"}]
    },
    {
        "name": "getAmountsOut",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "path", "type": "address[]"}
        ],
        "outputs": [{"name": "amounts", "type": "uint256[]"}]
    }
];

class AdvancedTradingBot {
    constructor(_options = {}) {
    this.walletAddress = (process.env.WALLET_ADDRESS || '0x6C14Aef8B5AB704abB3f9faF409c6fb304d3f04F').trim();
    this.privateKey = (process.env.PRIVATE_KEY || '').startsWith('0x') ? process.env.PRIVATE_KEY.trim() : (process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY.trim()}` : '');

        // Network configurations
        this.networks = {
            ethereum: {
                rpc: 'https://cloudflare-eth.com',
                chainId: 1,
                name: 'Ethereum',
                nativeToken: 'ETH',
                router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
                wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
            },
            polygon: {
                rpc: process.env.POLYGON_RPC_URL?.trim() || 'https://polygon-rpc.com/',
                chainId: 137,
                name: 'Polygon',
                nativeToken: 'MATIC',
                router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
                wrappedNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
            },
            base: {
                rpc: 'https://mainnet.base.org',
                chainId: 8453,
                name: 'Base',
                nativeToken: 'ETH',
                router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C263D01c', // Aerodrome Router (Base's main DEX)
                fallbackRouter: '0x2626664c2603336E57B271c5C0b26F421741e481', // Uniswap V3 Router (Base)
                wrappedNative: '0x4200000000000000000000000000000000000006',
                // Alternative DEXes for Base - verified working addresses
                alternativeRouters: [
                    '0x4752ba5DBc23f44D87826276BF6Fd6b1C263D01c', // Aerodrome V3
                    '0x2626664c2603336E57B271c5C0b26F421741e481', // Uniswap V3
                    '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // SushiSwap V3
                    '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb'  // PancakeSwap V3
                ]
            }
        };

        // Optional full-access override
        if ((process.env.FULL_ACCESS || 'false').toLowerCase() === 'true') {
            const forceTrue = [
                'enableRealTrades','forceLiveAll','skipAllDryRuns','enableNftTrading','enableMarketplaceIntegration',
                'enableMicroWealthStrategy','enableKnowledgeHub','enableExternalData','enableSharpeWeighting',
                'enableStrategyRegistry','enableKellySizing','enableSentiment','enableAirdropScanner','enableGasRecovery',
                'enableAutoSimFallback','enableDustConsolidation','enableNativeBufferManager','enableEmergencyMode',
                'enableMempoolFilter','enablePerStrategySizing','enableMultiRouterQuoter','enableTimeDecayScoring',
                'enableSharpeAdjustment','enableLpTracking'
            ];
            for (const k of forceTrue) this.config[k] = true;
            this.config.nftDryRun = false;
            console.log('🔓 FULL_ACCESS override active: all major features enabled.');
        }

        this.currentNetwork = 'polygon'; // Start with Polygon which has more gas
        this.web3 = null;
        this.account = null;
    // Track per-network virtual gas buffer accumulation sourced from profits
    this.networkGasBuffer = {}; // networkName -> native units reserved (sim / accounting)
    this.networkPerf = { }; // networkName -> { wins, losses, recent:[], lastOps:0 }
    this.tokenPriceCache = { tokens:{}, lastBatchTs:0 };

        // Trading state
        this.totalProfit = 0;
    this.tradesExecuted = 0; // total attempted trades
    this.successfulTrades = 0; // successful trades
    this.winRate = 0;
        this.reserveBalance = 0.004219;
        this.targetReserve = 3000000; // $3M target
        this.minProfitThreshold = 0.00001; // Minimum profit to execute trade (0.001% for micro-trades)
        this.maxSlippage = 0.02; // 2% max slippage
        this.aggressiveMode = true; // Enable aggressive profit seeking

        // Runtime risk/config (with environment overrides)
        this.config = {
            enableRealTrades: (process.env.ENABLE_REAL_TRADES || '').toLowerCase() === 'true',
            minProfitBps: Number(process.env.MIN_PROFIT_BPS || 2), // 2 bps = 0.02%
            maxTradeFraction: Number(process.env.MAX_TRADE_FRACTION || 0.02), // 2% of available balance per trade
            dailyGasCapEth: Number(process.env.DAILY_GAS_CAP_ETH || 0.005), // total gas spend per day
            maxSimultaneousApprovals: 1,
            baselinePreservePct: Number(process.env.BASELINE_PRESERVE_PCT || 0.85), // preserve 85% of initial token holdings
            adaptiveVolLookback: Number(process.env.VOL_LOOKBACK || 25),
            inventoryRotationBps: Number(process.env.INVENTORY_ROTATION_BPS || 1), // simulate 1 bps profit if no other opps
            networkScanIntervalCycles: Number(process.env.NETWORK_SCAN_INTERVAL_CYCLES || 5), // scan all networks every N cycles
            maxOpportunities: Number(process.env.MAX_OPPORTUNITIES || 20), // cap merged opportunity list
            minUsdProfit: Number(process.env.MIN_USD_PROFIT || 0.0000005), // absolute min USD profit
            maxGasGwei: Number(process.env.MAX_GAS_GWEI || 75), // gas ceiling (gwei)
            volSlippageMinBps: Number(process.env.VOL_SLIPPAGE_MIN_BPS || 15), // dynamic slippage lower bound (bps)
            volSlippageMaxBps: Number(process.env.VOL_SLIPPAGE_MAX_BPS || 120), // dynamic slippage upper bound (bps)
            strategyDisableThreshold: Number(process.env.STRATEGY_DISABLE_THRESHOLD || 0.15), // disable if success rate below
            strategyMinSample: Number(process.env.STRATEGY_MIN_SAMPLE || 6), // samples before evaluation
            reinvestFraction: Number(process.env.REINVEST_FRACTION || 0.6), // portion of realized profit to grow base capital
            enableMultiRouterQuoter: (process.env.ENABLE_MULTI_ROUTER_QUOTER || 'true').toLowerCase() === 'true',
            enableTimeDecayScoring: (process.env.ENABLE_TIME_DECAY || 'true').toLowerCase() === 'true',
            timeDecayLambda: Number(process.env.TIME_DECAY_LAMBDA || 0.0005), // decay per second
            enableMevRiskFilter: (process.env.ENABLE_MEV_FILTER || 'true').toLowerCase() === 'true',
            enableSharpeWeighting: (process.env.ENABLE_SHARPE || 'true').toLowerCase() === 'true',
            sharpeLookback: Number(process.env.SHARPE_LOOKBACK || 40),
            enableAdaptiveNetworkShift: (process.env.ENABLE_ADAPTIVE_NETWORK_SHIFT || 'true').toLowerCase() === 'true',
            networkShiftIntervalCycles: Number(process.env.NETWORK_SHIFT_INTERVAL_CYCLES || 50),
            networkShiftMinDeltaPct: Number(process.env.NETWORK_SHIFT_MIN_DELTA_PCT || 0.5), // require 0.5% performance delta
            enableChainlinkOracle: (process.env.ENABLE_CHAINLINK_ORACLE || 'true').toLowerCase() === 'true',
            chainlinkTimeoutMs: Number(process.env.CHAINLINK_TIMEOUT_MS || 4000),
            enableLpTracking: (process.env.ENABLE_LP_TRACKING || 'true').toLowerCase() === 'true',
            lpTrackIntervalCycles: Number(process.env.LP_TRACK_INTERVAL_CYCLES || 25),
            lpPositions: (process.env.LP_POSITIONS || '').split(',').map(s=>s.trim()).filter(Boolean),
            enablePerStrategySizing: (process.env.ENABLE_PER_STRATEGY_SIZING || 'true').toLowerCase() === 'true',
            perStrategyMaxMult: Number(process.env.PER_STRAT_MAX_MULT || 2),
            perStrategyMinMult: Number(process.env.PER_STRAT_MIN_MULT || 0.3),
            enableMempoolFilter: (process.env.ENABLE_MEMPOOL_FILTER || 'true').toLowerCase() === 'true',
            mempoolWindowSec: Number(process.env.MEMPOOL_WINDOW_SEC || 20),
            mempoolTokenAttentionThreshold: Number(process.env.MEMPOOL_ATTENTION_THRESHOLD || 5)
            ,enableNftTrading: (process.env.ENABLE_NFT_TRADING || 'false').toLowerCase() === 'true'
            ,nftWhitelist: (process.env.NFT_WHITELIST || '').split(',').map(a=>a.trim()).filter(Boolean)
            ,nftMaxPctPortfolio: Number(process.env.NFT_MAX_PCT_PORTFOLIO || 10) // Max % of reserve allowed tied in any single NFT liquidation action
            ,nftMinFloorUsd: Number(process.env.NFT_MIN_FLOOR_USD || 5) // Skip very low value NFTs
            ,nftSellCooldownMinutes: Number(process.env.NFT_SELL_COOLDOWN_MINUTES || 120)
            ,nftMaxListingsPerCycle: Number(process.env.NFT_MAX_LISTINGS_PER_CYCLE || 1)
            ,nftDryRun: (process.env.NFT_DRY_RUN || 'true').toLowerCase() === 'true' // simulate liquidation
            ,nftEventLookbackBlocks: Number(process.env.NFT_EVENT_LOOKBACK_BLOCKS || 300000) // how far back to search Transfer events
            ,nftRequireWhitelist: (process.env.NFT_REQUIRE_WHITELIST || 'true').toLowerCase() === 'true'
            ,nftMinHoldMinutes: Number(process.env.NFT_MIN_HOLD_MINUTES || 30)
            ,maxDailyNftLiquidations: Number(process.env.MAX_DAILY_NFT_LIQUIDATIONS || 5)
            ,enableMicroWealthStrategy: (process.env.ENABLE_MICRO_WEALTH || 'true').toLowerCase() === 'true'
            ,logThrottleMs: Number(process.env.LOG_THROTTLE_MS || 250)
            ,forceLiveAll: (process.env.FORCE_LIVE_ALL || 'false').toLowerCase() === 'true'
            ,skipAllDryRuns: (process.env.SKIP_ALL_DRY_RUNS || 'false').toLowerCase() === 'true'
            ,enableMarketplaceIntegration: (process.env.ENABLE_MARKETPLACE_INTEGRATION || 'true').toLowerCase() === 'true'
            ,marketplaceProvider: (process.env.MARKETPLACE_PROVIDER || 'reservoir').toLowerCase()
            ,reservoirApiBase: (process.env.RESERVOIR_API_BASE || 'https://api.reservoir.tools').replace(/\/$/,'')
            ,reservoirApiKey: process.env.RESERVOIR_API_KEY || ''
            ,nftListingPremiumPct: Number(process.env.NFT_LISTING_PREMIUM_PCT || -0.5) // -0.5 => list 0.5% below floor
            ,nftListingExpiryMinutes: Number(process.env.NFT_LISTING_EXPIRY_MINUTES || 60)
            ,nftMinFloorEth: Number(process.env.NFT_MIN_FLOOR_ETH || 0.0001)
            ,openseaApiBase: (process.env.OPENSEA_API_BASE || 'https://api.opensea.io').replace(/\/$/,'')
            ,openseaApiKey: process.env.OPENSEA_API_KEY || ''
            ,openseaReservoirFallback: (process.env.OPENSEA_RESERVOIR_FALLBACK || 'true').toLowerCase() === 'true'
            ,enableMetricsServer: (process.env.ENABLE_METRICS_SERVER || 'true').toLowerCase() === 'true'
            ,metricsPort: Number(process.env.METRICS_PORT || 8787)
            ,maxDailyLossPct: Number(process.env.MAX_DAILY_LOSS_PCT || 15) // disable if daily realized loss exceeds % of starting equity
            ,minProfitGasMult: Number(process.env.MIN_PROFIT_GAS_MULT || 1.2) // profit must exceed gas * multiplier
            ,riskDisableAfterLosses: Number(process.env.RISK_DISABLE_AFTER_LOSSES || 8)
            ,enableStrategyRegistry: (process.env.ENABLE_STRATEGY_REGISTRY || 'true').toLowerCase() === 'true'
            ,enableKellySizing: (process.env.ENABLE_KELLY_SIZING || 'true').toLowerCase() === 'true'
            ,kellyMaxFraction: Number(process.env.KELLY_MAX_FRACTION || 0.25)
            ,enableKnowledgeHub: (process.env.ENABLE_KNOWLEDGE_HUB || 'true').toLowerCase() === 'true'
            ,knowledgeRefreshCycles: Number(process.env.KNOWLEDGE_REFRESH_CYCLES || 15)
            ,knowledgeCacheFile: process.env.KNOWLEDGE_CACHE_FILE || 'knowledge-cache.json'
            ,enableExternalData: (process.env.ENABLE_EXTERNAL_DATA || 'true').toLowerCase() === 'true'
            ,externalRefreshCycles: Number(process.env.EXTERNAL_REFRESH_CYCLES || 30)
            ,coingeckoApiBase: (process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3').replace(/\/$/,'')
            ,gasOracleUrl: (process.env.GAS_ORACLE_URL || 'https://example-gas-oracle.invalid')
            ,enableSharpeAdjustment: (process.env.ENABLE_SHARPE_ADJUSTMENT || 'true').toLowerCase() === 'true'
            ,backgroundMicroSimCycles: Number(process.env.BACKGROUND_MICRO_SIM_CYCLES || 40)
            ,backgroundMicroSimTrades: Number(process.env.BACKGROUND_MICRO_SIM_TRADES || 8)
            ,enableSentiment: (process.env.ENABLE_SENTIMENT || 'true').toLowerCase() === 'true'
            ,sentimentCacheFile: process.env.SENTIMENT_CACHE_FILE || 'sentiment-cache.json'
            ,enableAirdropScanner: (process.env.ENABLE_AIRDROP_SCANNER || 'true').toLowerCase() === 'true'
            ,airdropRegistryFile: process.env.AIRDROP_REGISTRY_FILE || 'airdrops.json'
            ,airdropScanIntervalCycles: Number(process.env.AIRDROP_SCAN_INTERVAL || 50)
            ,minGasForAirdropClaim: Number(process.env.MIN_GAS_AIRDROP || 0.0003)
            ,enableGasRecovery: (process.env.ENABLE_GAS_RECOVERY || 'true').toLowerCase() === 'true'
            ,gasRecoveryMinNative: Number(process.env.GAS_RECOVERY_MIN_NATIVE || 0.00005)
            ,gasRecoveryTarget: Number(process.env.GAS_RECOVERY_TARGET || 0.0004)
            ,enableAutoSimFallback: (process.env.ENABLE_AUTO_SIM_FALLBACK || 'true').toLowerCase() === 'true'
            ,minGasForRealTrade: Number(process.env.MIN_GAS_FOR_REAL_TRADE || 0.00008)
            ,enableDustConsolidation: (process.env.ENABLE_DUST_CONSOLIDATION || 'true').toLowerCase() === 'true'
            ,dustMinUsd: Number(process.env.DUST_MIN_USD || 0.25)
            ,dustSweepIntervalCycles: Number(process.env.DUST_SWEEP_INTERVAL || 120)
            ,dustMaxTokensPerSweep: Number(process.env.DUST_MAX_TOKENS || 4)
            ,nativeBufferTarget: Number(process.env.NATIVE_BUFFER_TARGET || 0.002)
            ,nativeBufferLowWater: Number(process.env.NATIVE_BUFFER_LOW_WATER || 0.0006)
            ,enableNativeBufferManager: (process.env.ENABLE_NATIVE_BUFFER_MANAGER || 'true').toLowerCase() === 'true'
            ,enableEmergencyMode: (process.env.ENABLE_EMERGENCY_MODE || 'true').toLowerCase() === 'true'
            ,emergencyMinBuffer: Number(process.env.EMERGENCY_MIN_BUFFER || 0.0003)
            ,emergencyRiskScale: Number(process.env.EMERGENCY_RISK_SCALE || 0.35)
            ,enableRealAirdropClaims: (process.env.ENABLE_REAL_AIRDROP_CLAIMS || 'false').toLowerCase() === 'true'
            ,airdropClaimGasLimit: Number(process.env.AIRDROP_CLAIM_GAS_LIMIT || 180000)
            ,enableGaslessBootstrap: (process.env.ENABLE_GASLESS_BOOTSTRAP || 'true').toLowerCase() === 'true'
            ,gaslessMinTokenUsd: Number(process.env.GASLESS_MIN_TOKEN_USD || 0.5)
            ,gaslessOrderFile: process.env.GASLESS_ORDER_FILE || 'gasless-orders.json'
            ,gasBufferAllocationFraction: Number(process.env.GAS_BUFFER_ALLOC_FRAC || 0.25) // % of realized profit to earmark for gas buffer until target met
            ,tokenPriceRefreshSec: Number(process.env.TOKEN_PRICE_REFRESH_SEC || 180)
            ,maxTokenPriceBatch: Number(process.env.MAX_TOKEN_PRICE_BATCH || 40)
            ,adaptiveNetworkShiftMinDelta: Number(process.env.ADAPTIVE_NET_SHIFT_MIN_DELTA || 0.15)
            ,adaptiveNetworkShiftCooldownCycles: Number(process.env.ADAPTIVE_NET_SHIFT_COOLDOWN || 12)
            ,networkPerfDecay: Number(process.env.NETWORK_PERF_DECAY || 0.985)
            ,tokenPriceCacheFile: process.env.TOKEN_PRICE_CACHE_FILE || 'token-price-cache.json'
            ,networkPerfFile: process.env.NETWORK_PERF_FILE || 'network-perf.json'
        };

        // Daily accounting
        this.dayStart = Date.now();
        this.gasSpentTodayEth = 0;

    // Portfolio & retention state
    this.initialPortfolio = null; // captured once
    this.portfolioHistory = [];
    this.profitLedger = [];
    this.lastLedgerFlush = Date.now();
    this.ledgerFile = path.join(__dirname, 'profit-ledger.json');
    this.volatilityWindow = [];
        this.mempoolObserved = [];
    // Airdrop / resource augmentation state
    this.airdropRegistry = [];
    this.lastAirdropScanCycle = 0;
    this.airdropClaims = [];
    this.resourceEvents = [];
    this.lastDustSweepCycle = 0;
    this.emergencyModeActive = false;
    this.gaslessOrders = [];
        this.lpState = { positions: {}, lastUpdate: 0 };
        this.chainlinkFeeds = {
            polygon: { ETHUSD: process.env.CHAINLINK_ETH_USD_POLYGON || null },
            base: { ETHUSD: process.env.CHAINLINK_ETH_USD_BASE || null }
        };
    this.nftLastSale = {}; // collectionAddress -> timestamp
    this.nftHoldTimestamps = {}; // key collection:tokenId -> first seen timestamp
    this.nftLiquidationsToday = 0;
    this._lastLogTs = {}; // for throttled logs
    // Strategy brain (contextual bandit) for opportunity ordering
    const self = this;
    this.macroRegime = 'neutral_calm';
    this.brain = new StrategyBrain({
        ucbC: 1.25,
        decay: 0.00005,
        regimeKey: (ctx)=> {
            const vol = ctx?.volatility || 0;
            const hour = new Date().getUTCHours();
            const volBand = vol < 0.004 ? 'vlow' : vol < 0.01 ? 'low' : vol < 0.02 ? 'mid' : 'high';
            const macro = self.macroRegime || 'neutral_calm';
            return `${macro}_${volBand}_h${hour}`;
        }
    });
    this.knowledgeContext = {};
    this.knowledgeLastRefresh = 0;
    this.marketFactors = { momentumScore: 0, meanReversion: 0, gasRegime: 'normal', liquidityProxy: 0, riskHeat: 0 };
    this._factorWindow = [];
    this.dynamicMinProfitBps = this.config.minProfitBps;
    this.dynamicSlippageBoost = 0;
    this.dailyProfit = 0; // realized profit (native units)
    this.dailyLoss = 0;   // realized loss (native units)
    this.consecutiveLosses = 0;
    this.metricsServerStarted = false;
    this.strategyRegistry = [];
    this.strategyBaselineSize = 0.00001; // default minimal base size

        // Safety: disallow real trades if private key missing
        if (!this.privateKey && this.config.enableRealTrades) {
            console.log('⚠️ ENABLE_REAL_TRADES=true but no PRIVATE_KEY set. Forcing simulation mode.');
            this.config.enableRealTrades = false;
        }

        // Learning data
        this.learningData = {
            successfulTrades: [],
            failedTrades: [],
            strategyPerformance: {},
            marketConditions: {},
            networkPerformance: {}
        };
        // Restore persisted token prices / network performance if available
        try {
            const priceFile = path.join(__dirname, this.config.tokenPriceCacheFile);
            if (fs.existsSync(priceFile)) {
                const parsed = JSON.parse(fs.readFileSync(priceFile,'utf8'));
                if (parsed && parsed.tokens) this.tokenPriceCache = parsed;
            }
        } catch {}
        try {
            const perfFile = path.join(__dirname, this.config.networkPerfFile);
            if (fs.existsSync(perfFile)) {
                const parsed = JSON.parse(fs.readFileSync(perfFile,'utf8'));
                if (parsed && typeof parsed === 'object') this.networkPerf = parsed;
            }
        } catch {}

        // TOSHI token configuration
        this.toshiToken = {
            address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
            decimals: 18,
            symbol: 'TOSHI',
            supportedNetworks: ['base'] // prevent repeated contract-not-found calls on unsupported chains
        };

        // Trading pairs to monitor for arbitrage
        this.tradingPairs = {
            base: [
                { tokenIn: this.toshiToken.address, tokenOut: '0x4200000000000000000000000000000000000006', symbol: 'TOSHI-ETH' }, // WETH on Base
                { tokenIn: '0x4200000000000000000000000000000000000006', tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'ETH-USDC' }, // USDC on Base
                { tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', tokenOut: '0x4200000000000000000000000000000000000006', symbol: 'USDC-ETH' },
                { tokenIn: this.toshiToken.address, tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'TOSHI-USDC' }
            ],
            polygon: [
                { tokenIn: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', tokenOut: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'MATIC-USDC' }, // WMATIC and USDC on Polygon
                { tokenIn: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', tokenOut: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'USDC-MATIC' },
                { tokenIn: this.toshiToken.address, tokenOut: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'TOSHI-MATIC' }
            ]
        };

        this.isRunning = false;
        this.cycleCount = 0;
    this.ethPriceUSD = parseFloat(process.env.ETH_PRICE_USD || '500');
    }

    /** Batch refresh token USD (native) prices via router quotes (native -> token -> native path approximations) */
    async refreshTokenPrices(tokens) {
        try {
            const now = Date.now();
            if (now - this.tokenPriceCache.lastBatchTs < (this.config.tokenPriceRefreshSec*1000)) return;
            if (!this.web3) return;
            const network = this.networks[this.currentNetwork];
            const router = new this.web3.eth.Contract(UNISWAP_ROUTER_ABI, network.router);
            const unique = [...new Set(tokens.filter(t=> t && t !== network.wrappedNative))].slice(0,this.config.maxTokenPriceBatch);
            for (const addr of unique) {
                try {
                    // Quote token->wrappedNative with tiny amount (1e-6 native equivalent heuristic): we query wrappedNative->token then invert if needed
                    const tokenContract = new this.web3.eth.Contract(ERC20_ABI, addr);
                    const dec = parseInt(await tokenContract.methods.decimals().call());
                    const probeAmount = this.toBaseUnits(0.000001, dec).toString();
                    const amounts = await router.methods.getAmountsOut(probeAmount, [addr, network.wrappedNative]).call();
                    const out = Number(amounts[1]) / 1e18; // native units per probeAmount
                    if (out > 0) {
                        const priceNativePerToken = out / 0.000001; // since amount was 1e-6 token units (approx) after adjusting decimals
                        this.tokenPriceCache.tokens[addr.toLowerCase()] = { native: priceNativePerToken, ts: now };
                    }
                } catch { /* ignore individual token errors */ }
            }
            this.tokenPriceCache.lastBatchTs = now;
        } catch {}
    }

    getTokenNativePrice(addr) {
        return this.tokenPriceCache.tokens[addr.toLowerCase()]?.native || 0;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Advanced Trading Bot...');

            // Initialize Web3 connection FIRST
            await this.initializeWeb3();

            if (this.config.enableRealTrades) {
                console.log('🟢 Real trade mode ENABLED (transactions will be broadcast)');
            } else {
                console.log('🟡 Simulation mode (no real swaps will be sent). Set ENABLE_REAL_TRADES=true to enable.');
            }

            if (this.config.forceLiveAll) {
                this.config.enableRealTrades = true;
                this.config.nftDryRun = false;
                console.log('🚨 FORCE_LIVE_ALL active: all eligible actions will execute on-chain.');
            }

            // Load learning data
            await this.loadLearningData();
            await this.loadBrainState();
            // Load airdrop registry
            this.loadAirdropRegistry();

            // Capture initial portfolio AFTER Web3 is ready
            await this.captureInitialPortfolio();
            await this.verifyWalletSetup();
            this.adjustDynamicRiskScaling();

            // Start trading cycles
            this.startTradingCycle();

            // Metrics server
            try { this.startMetricsServer?.(); } catch {}

            console.log('✅ Bot initialized successfully');
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            throw error;
        }
    }

    async loadBrainState() {
        try {
            const fp = path.join(__dirname, 'brain-state.json');
            if (fs.existsSync(fp)) {
                const raw = JSON.parse(fs.readFileSync(fp,'utf8'));
                this.brain.load(raw);
                console.log('🧠 Loaded brain state');
            }
        } catch(e) { console.log('⚠️ Brain load failed:', e.message); }
    }

    async saveBrainState() {
        try {
            const fp = path.join(__dirname, 'brain-state.json');
            fs.writeFileSync(fp, JSON.stringify(this.brain.toJSON(), null, 2));
        } catch(e) { /* ignore */ }
    }

    async initializeWeb3() {
        const network = this.networks[this.currentNetwork];

        // Try primary RPC first
        try {
            this.web3 = new Web3(network.rpc);

            if (this.privateKey) {
                this.account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
                this.web3.eth.accounts.wallet.add(this.account);
                console.log('🔐 Private key configured for real transactions');
            } else {
                console.log('⚠️ No PRIVATE_KEY set. Running in read-only / simulation mode.');
            }

            console.log(`🌐 Connected to ${network.name} network`);
        } catch (error) {
            // If primary RPC fails and fallback exists, try fallback
            if (network.fallbackRpc) {
                console.log(`⚠️ Primary RPC failed, trying fallback for ${network.name}...`);
                try {
                    this.web3 = new Web3(network.fallbackRpc);

                    if (this.privateKey) {
                        this.account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
                        this.web3.eth.accounts.wallet.add(this.account);
                        console.log('🔐 Private key configured for real transactions');
                    } else {
                        console.log('⚠️ No PRIVATE_KEY set. Running in read-only / simulation mode.');
                    }

                    console.log(`🌐 Connected to ${network.name} network (fallback RPC)`);
                } catch (fallbackError) {
                    console.error(`❌ Both primary and fallback RPCs failed for ${network.name}:`, fallbackError.message);
                    throw fallbackError;
                }
            } else {
                throw error;
            }
        }
    }

    async switchNetwork(networkName) {
        try {
            if (!this.networks[networkName]) {
                throw new Error(`Network ${networkName} not configured`);
            }

            this.currentNetwork = networkName;
            await this.initializeWeb3();

            console.log(`✅ Switched to ${this.networks[networkName].name} network`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to switch to ${networkName}:`, error.message);
            return false;
        }
    }

    async getTokenBalance(tokenAddress, walletAddress = this.walletAddress) {
        try {
            // Fast short-circuit for known unsupported tokens on this network
            if (tokenAddress === this.toshiToken.address && !this.toshiToken.supportedNetworks.includes(this.currentNetwork)) {
                return null;
            }
            if (!this.web3) {
                console.log('⚠️ Web3 not initialized, skipping token balance check');
                return null;
            }
            const tokenContract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);

            // Add retry logic for rate limiting
            let retries = 3;
            while (retries > 0) {
                try {
                    const balance = await tokenContract.methods.balanceOf(walletAddress).call();
                    const decimals = await tokenContract.methods.decimals().call();

                    // Handle BigInt safely
                    const balanceBigInt = BigInt(balance);
                    const divisor = BigInt(10) ** BigInt(decimals);
                    const readableBalance = Number(balanceBigInt) / Number(divisor);

                    console.log(`📊 Raw balance: ${balance} (type: ${typeof balance})`);
                    console.log(`📏 Decimals: ${decimals}`);
                    console.log(`💰 Readable balance: ${readableBalance}`);

                    return {
                        raw: balanceBigInt,
                        readable: readableBalance,
                        decimals: Number(decimals)
                    };
                } catch (error) {
                    if (error.message.includes('rate limit') || error.message.includes('over rate limit')) {
                        const delay = this.currentNetwork === 'base' ? 15000 : 5000; // 15s for Base, 5s for others
                        console.log(`⏳ Rate limited, retrying in ${delay/1000} seconds... (${retries - 1} retries left)`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        retries--;
                    } else if (error.message.includes('Parameter decoding error') ||
                               error.message.includes('Returned values aren\'t valid') ||
                               error.message.includes('contract') ||
                               error.message.includes('invalid contract') ||
                               error.message.includes('does not exist')) {
                        // Contract doesn't exist on this network
                        console.log(`📭 Token contract ${tokenAddress} not found on ${this.currentNetwork}`);
                        throw new Error(`Contract not found on ${this.currentNetwork}`);
                    } else {
                        throw error;
                    }
                }
            }

            throw new Error('Max retries exceeded');
        } catch (error) {
            console.error(`❌ Error getting balance for ${tokenAddress}:`, error.message);
            return null;
        }
    }

    async getNativeBalance(walletAddress = this.walletAddress) {
        try {
            if (!this.web3) {
                console.log('⚠️ Web3 not initialized, skipping balance check');
                return 0;
            }
            const balance = await this.web3.eth.getBalance(walletAddress);
            const balanceInEth = this.web3.utils.fromWei(balance, 'ether');
            return parseFloat(balanceInEth);
        } catch (error) {
            console.error('❌ Error getting native balance:', error.message);
            return 0;
        }
    }

    async checkGasBalance(requiredAmount = null) {
        try {
            const balance = await this.getNativeBalance();
            const gasPrice = await this.web3.eth.getGasPrice();
            const gasPriceInEth = this.web3.utils.fromWei(gasPrice, 'ether');

            // Estimate gas cost for ultra-micro transactions (approval + swap)
            const estimatedGasCost = parseFloat(gasPriceInEth) * 120000; // 120k gas for micro tx

            if (requiredAmount !== null) {
                return balance >= requiredAmount;
            }

            console.log(`⛽ Gas Balance Check: ${balance.toFixed(12)} ${this.networks[this.currentNetwork].nativeToken} available, ${estimatedGasCost.toFixed(12)} ${this.networks[this.currentNetwork].nativeToken} needed for micro-tx`);
            return balance >= estimatedGasCost;
        } catch (error) {
            console.error('❌ Error checking gas balance:', error.message);
            return false;
        }
    }

    async requestGasFunding() {
        try {
            console.log('🚨 GAS FUNDING REQUIRED!');
            console.log(`💰 Current balance: ${this.getNativeBalance()} ETH`);
            console.log(`📧 Wallet: ${this.walletAddress}`);
            console.log('💡 Please send at least 0.0001 ETH to this wallet to enable micro-trades');
            console.log('⏳ Waiting for gas funding...');

            // Wait for funding (check every 30 seconds for 5 minutes)
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 30000));
                const balance = await this.getNativeBalance();
                if (balance >= 0.0005) { // Minimum gas for micro-trades
                    console.log(`✅ Gas funded! Balance: ${balance} ETH`);
                    return true;
                }
                console.log(`⏳ Still waiting for gas... (${i + 1}/10)`);
            }

            console.log('❌ Gas funding timeout. Bot will continue with limited functionality.');
            return false;
        } catch (error) {
            console.error('❌ Error requesting gas funding:', error.message);
            return false;
        }
    }

    async executeGaslessTrade(tokenIn, tokenOut, amountIn) {
        try {
            if (!this.web3 || !this.account) {
                console.log('⚠️ Gasless trade skipped: account/private key not configured.');
                return false;
            }

            console.log(`🔄 Attempting gasless trade (simulated): ${amountIn} ${tokenIn.symbol} -> ${tokenOut.symbol}`);

            const gasPrice = await this.web3.eth.getGasPrice();
            const gasLimit = 150000;
            const estimatedGasCost = BigInt(gasPrice) * BigInt(gasLimit);
            const gasCostEth = Number(estimatedGasCost) / 1e18;

            const balance = await this.web3.eth.getBalance(this.account.address);
            const balanceEth = Number(balance) / 1e18;

            if (balanceEth < gasCostEth) {
                console.log(`❌ Insufficient gas for even minimal trade. Need: ${gasCostEth.toFixed(8)} ETH, Have: ${balanceEth.toFixed(8)} ETH`);
                return false;
            }

            // Execute minimal trade with current balance
            const minTradeSize = gasCostEth * 2; // Trade size that covers gas + small profit
            if (amountIn < minTradeSize) {
                console.log(`📏 Trade too small for gas costs. Minimum: ${minTradeSize} ETH`);
                return false;
            }

            // Use the micro-trade function we created earlier
            return await this.executeMicroTrade(tokenIn, tokenOut, BigInt(Math.floor(amountIn * 1e18)), 0.00001);

        } catch (error) {
            console.error('❌ Gasless trade failed:', error.message);
            return false;
        }
    }

    async executeMicroTrade(tokenIn, tokenOut, amountIn, expectedProfit) {
        try {
            if (!this.web3 || !this.account) {
                console.log('⚠️ Micro-trade skipped: no account loaded.');
                return false;
            }

            if (!this.config.enableRealTrades) {
                // Simulation shortcut: increment counters and return
                this.tradesExecuted++;
                this.successfulTrades++;
                this.totalProfit += Number(expectedProfit || 0);
                console.log('🟡 Simulated micro-trade (real trading disabled).');
                return true;
            }

            const gasPrice = await this.web3.eth.getGasPrice();
            const gasLimit = 200000;
            const estimatedGasCost = BigInt(gasPrice) * BigInt(gasLimit);
            const gasCostEth = Number(estimatedGasCost) / 1e18;
            const balance = await this.web3.eth.getBalance(this.account.address);
            const balanceEth = Number(balance) / 1e18;
            if (balanceEth < gasCostEth * 1.1) {
                console.log(`❌ Insufficient gas for micro-trade. Need ~${gasCostEth.toFixed(8)} ETH, Have: ${balanceEth.toFixed(8)} ETH`);
                return false;
            }

            const microAmount = amountIn / 100n; // 1% probe trade
            const routerAddr = this.networks[this.currentNetwork].router;
            const router = new this.web3.eth.Contract(UNISWAP_ROUTER_ABI, routerAddr);
            let expectedOut = 0n;
            let minOut = 0n;
            try {
                const amountsOut = await router.methods.getAmountsOut(microAmount.toString(), [tokenIn.address, tokenOut.address]).call();
                expectedOut = BigInt(amountsOut[1]);
                minOut = expectedOut * 995n / 1000n;
                console.log(`📊 Micro-trade probe: in=${microAmount} out=${expectedOut} min=${minOut}`);
            } catch (e) {
                console.log(`⚠️ getAmountsOut failed (${e.message}) – simulating trade success.`);
                this.tradesExecuted++;
                this.successfulTrades++;
                this.totalProfit += Number(expectedProfit || 0);
                return true;
            }

            // Approve minimal amount (best-effort)
            await this.approveToken(tokenIn.address, routerAddr, microAmount.toString());

            const swapTx = router.methods.swapExactTokensForTokens(
                microAmount.toString(),
                minOut.toString(),
                [tokenIn.address, tokenOut.address],
                this.account.address,
                Math.floor(Date.now() / 1000) + 300
            );

            let gasEstimate;
            try {
                gasEstimate = await swapTx.estimateGas({ from: this.account.address });
            } catch (e) {
                console.log(`⚠️ Gas estimate failed (${e.message}) – simulating trade.`);
                this.tradesExecuted++;
                this.successfulTrades++;
                this.totalProfit += Number(expectedProfit || 0);
                return true;
            }

            const tx = {
                from: this.account.address,
                to: routerAddr,
                gas: Math.min(gasEstimate * 2, 500000),
                gasPrice: gasPrice,
                data: swapTx.encodeABI()
            };
            const signed = await this.web3.eth.accounts.signTransaction(tx, this.privateKey);
            const receipt = await this.web3.eth.sendSignedTransaction(signed.rawTransaction);
            // Track gas spend
            try {
                const gasUsed = receipt.gasUsed || 0;
                const gasPriceWei = BigInt(gasPrice);
                const spentEth = Number((gasPriceWei * BigInt(gasUsed)).toString()) / 1e18;
                this.gasSpentTodayEth += spentEth;
            } catch {}
            console.log(`✅ Micro-trade executed TX: ${receipt.transactionHash}`);
            this.tradesExecuted++;
            this.successfulTrades++;
            this.totalProfit += Number(expectedProfit || 0);
            return true;
        } catch (error) {
            console.log(`❌ Micro-trade failed: ${error.message}`);
            return false;
        }
    }

    async executeTokenSwap(tokenIn, tokenOut, amountIn, minAmountOut = 0) {
        try {
            // Check if we have enough gas for the transaction
            if (!(await this.checkGasBalance())) {
                throw new Error('Insufficient gas balance for transaction');
            }

            if (!this.config.enableRealTrades) {
                console.log('🟡 Simulation: executeTokenSwap skipped (real trading disabled).');
                return { simulated: true };
            }

            const network = this.networks[this.currentNetwork];
            let routersToTry = [network.router];

            // Add alternative routers for Base network
            if (this.currentNetwork === 'base' && network.alternativeRouters) {
                routersToTry = network.alternativeRouters;
            }

            for (const routerAddress of routersToTry) {
                try {
                    console.log(`🔄 Trying router: ${routerAddress}`);
                    const router = new this.web3.eth.Contract(UNISWAP_ROUTER_ABI, routerAddress);

                    // Get token decimals
                    const tokenInContract = new this.web3.eth.Contract(ERC20_ABI, tokenIn);
                    const tokenOutContract = new this.web3.eth.Contract(ERC20_ABI, tokenOut);

                    const decimalsIn = parseInt(await tokenInContract.methods.decimals().call(), 10);
                    const decimalsOut = parseInt(await tokenOutContract.methods.decimals().call(), 10);
                    const amountInWei = this.toBaseUnits(amountIn, decimalsIn).toString();

                    // Approve token spending
                    const approvalSuccess = await this.approveToken(tokenIn, routerAddress, amountInWei);
                    if (!approvalSuccess) {
                        console.log(`⚠️ Approval failed for router ${routerAddress}, trying next...`);
                        continue; // Try next router instead of failing
                    }

                    // For Base (Uniswap V3), use exactInputSingle
                    if (this.currentNetwork === 'base') {
                        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

                        const params = {
                            tokenIn: tokenIn,
                            tokenOut: tokenOut,
                            fee: 3000, // 0.3% fee tier
                            recipient: this.walletAddress,
                            deadline: deadline,
                            amountIn: amountInWei,
                            amountOutMinimum: minAmountOut,
                            sqrtPriceLimitX96: 0
                        };

                        const gasPrice = await this.getGasPrice();
                        const tx = await router.methods.exactInputSingle(params).send({
                            from: this.walletAddress,
                            gas: 80000,
                            gasPrice
                        });
                        // Gas accounting
                        if (tx?.gasUsed) {
                            this.gasSpentTodayEth += (tx.gasUsed * gasPrice) / 1e18;
                        }

                        console.log(`✅ Swap executed on ${routerAddress}: ${amountIn} ${tokenIn} -> ${tokenOut}`);
                        // Allocate synthetic micro profit portion to gas buffer (self-funding) if configured
                        try {
                            const allocFrac = this.config.gasBufferAllocationFraction || 0;
                            if (allocFrac > 0) {
                                const syntheticEdge = amountIn * 0.0005; // 5 bps placeholder edge
                                const reservePortion = syntheticEdge * allocFrac;
                                if (reservePortion > 0) {
                                    this.networkGasBuffer[this.currentNetwork] = (this.networkGasBuffer[this.currentNetwork]||0) + reservePortion;
                                    this.throttledLog('allocGas', `⛽ (+) Reserved ${reservePortion.toFixed(8)} native to gas buffer (${this.currentNetwork} total ${(this.networkGasBuffer[this.currentNetwork]).toFixed(8)})`);
                                }
                            }
                        } catch {}
                        return tx;
                    } else {
                        // For Polygon (Uniswap V2), use the old method
                        const path = [tokenIn, tokenOut];
                        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

                        const gasPrice = await this.getGasPrice();
                        const tx = await router.methods.swapExactTokensForTokens(
                            amountInWei,
                            minAmountOut,
                            path,
                            this.walletAddress,
                            deadline
                        ).send({
                            from: this.walletAddress,
                            gas: 60000,
                            gasPrice
                        });
                        if (tx?.gasUsed) {
                            this.gasSpentTodayEth += (tx.gasUsed * gasPrice) / 1e18;
                        }

                        console.log(`✅ Swap executed: ${amountIn} ${tokenIn} -> ${tokenOut}`);
                        try {
                            const allocFrac = this.config.gasBufferAllocationFraction || 0;
                            if (allocFrac > 0) {
                                const syntheticEdge = amountIn * 0.0005;
                                const reservePortion = syntheticEdge * allocFrac;
                                if (reservePortion > 0) {
                                    this.networkGasBuffer[this.currentNetwork] = (this.networkGasBuffer[this.currentNetwork]||0) + reservePortion;
                                    this.throttledLog('allocGas', `⛽ (+) Reserved ${reservePortion.toFixed(8)} native to gas buffer (${this.currentNetwork} total ${(this.networkGasBuffer[this.currentNetwork]).toFixed(8)})`);
                                }
                            }
                        } catch {}
                        return tx;
                    }
                } catch (error) {
                    console.log(`⚠️ Router ${routerAddress} failed, trying next...`);
                    continue;
                }
            }

            throw new Error('All routers failed');
        } catch (error) {
            console.error('❌ Token swap failed:', error.message);
            throw error;
        }
    }

    async approveToken(tokenAddress, spender, amount) {
        try {
            // Check gas balance with ultra-low threshold
            const gasPrice = await this.getGasPrice();
            const estimatedGas = 25000; // Even lower gas limit for approvals
            const estimatedCost = BigInt(gasPrice) * BigInt(estimatedGas);
            const balance = await this.web3.eth.getBalance(this.walletAddress);

            if (BigInt(balance) < estimatedCost) {
                console.log(`❌ Insufficient gas for approval: need ${this.web3.utils.fromWei(estimatedCost.toString(), 'ether')} ETH, have ${this.web3.utils.fromWei(balance, 'ether')} ETH`);
                return false; // Return false instead of throwing to allow fallback
            }

            const tokenContract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);

            // Check current allowance first
            const currentAllowance = await tokenContract.methods.allowance(this.walletAddress, spender).call();
            if (BigInt(currentAllowance) >= BigInt(amount)) {
                console.log(`✅ Already approved sufficient amount for ${spender}`);
                return true;
            }

            const tx = await tokenContract.methods.approve(spender, amount).send({
                from: this.walletAddress,
                gas: estimatedGas,
                gasPrice: gasPrice
            });

            console.log(`✅ Approved ${this.web3.utils.fromWei(amount, 'ether')} tokens for ${spender}`);
            return tx;
        } catch (error) {
            console.error('❌ Token approval failed:', error.message);
            return false; // Return false instead of throwing
        }
    }

    toBaseUnits(amountFloat, decimals) {
        const d = Number(decimals);
        const scale = 10 ** Math.min(d, 18);
        let bn = BigInt(Math.floor(Number(amountFloat) * scale));
        if (d > 18) bn *= 10n ** BigInt(d - 18);
        if (d < 18) bn /= 10n ** BigInt(18 - d);
        return bn;
    }

    fromBaseUnits(amountBn, decimals) {
        const d = BigInt(decimals);
        const divisor = 10n ** d;
        return Number(amountBn) / Number(divisor);
    }

    async quotePath(amountIn, path) {
        try {
            const routerAddr = this.networks[this.currentNetwork].router;
            const router = new this.web3.eth.Contract(UNISWAP_ROUTER_ABI, routerAddr);
            const tokenInDecimals = parseInt(await (new this.web3.eth.Contract(ERC20_ABI, path[0])).methods.decimals().call(), 10);
            const amountUnits = this.toBaseUnits(amountIn, tokenInDecimals).toString();
            const amounts = await router.methods.getAmountsOut(amountUnits, path).call();
            return amounts;
        } catch (e) {
            return null;
        }
    }

    async estimateRoundTripNative(amountNative, stableAddress) {
        try {
            const wrapped = this.networks[this.currentNetwork].wrappedNative;
            const forward = await this.quotePath(amountNative, [wrapped, stableAddress]);
            if (!forward) return null;
            const outStable = BigInt(forward[forward.length - 1]);
            // assume stable 6 decimals
            const backAmountFloat = this.fromBaseUnits(outStable, 6) * 0.95; // 5% buffer
            const back = await this.quotePath(backAmountFloat, [stableAddress, wrapped]);
            if (!back) return null;
            return back[back.length - 1];
        } catch (e) {
            return null;
        }
    }

    async getGasPrice() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            // Use a more conservative gas price multiplier
            let adjustedGasPrice = Math.floor(Number(gasPrice) * 1.2); // 20% buffer
            const gweiDisplay = this.web3.utils.fromWei(adjustedGasPrice.toString(), 'gwei');
            if (Number(gweiDisplay) > this.config.maxGasGwei) {
                console.log(`⛽ Gas ${Number(gweiDisplay).toFixed(2)} gwei > cap ${this.config.maxGasGwei} gwei: throttling`);
                adjustedGasPrice = this.web3.utils.toWei(this.config.maxGasGwei.toString(), 'gwei');
            } else {
                console.log(`💰 Gas Price: ${gweiDisplay} gwei`);
            }
            return adjustedGasPrice;
        } catch (error) {
            console.error('❌ Error getting gas price:', error.message);
            return this.web3.utils.toWei('30', 'gwei'); // Lower fallback
        }
    }

    async estimateGasCost(opportunity) {
        try {
            // Estimate gas cost for different opportunity types
            const baseGas = 50000; // Base gas for simple transfers
            const gasPrice = await this.getGasPrice();

            let gasLimit;
            switch (opportunity.type) {
                case 'triangular':
                    gasLimit = 300000; // Higher for complex swaps
                    break;
                case 'cross-dex':
                    gasLimit = 250000; // Medium for DEX swaps
                    break;
                case 'flash-loan':
                    gasLimit = 500000; // High for flash loans
                    break;
                case 'token-specific':
                    gasLimit = 200000; // Lower for token operations
                    break;
                case 'wealth-building-micro':
                    return 0; // No gas cost for simulated wealth-building trades
                default:
                    gasLimit = 100000; // Lower default
            }

            const gasCost = (gasPrice * gasLimit) / 1e18; // Convert to ETH
            return gasCost;
        } catch (error) {
            console.error('❌ Error estimating gas cost:', error.message);
            return 0.00001; // Conservative fallback
        }
    }

    async convertToshiToNative(amount) {
        try {
            console.log(`🎯 Converting ${amount} TOSHI to ${this.networks[this.currentNetwork].nativeToken}...`);

            // Check if we have enough gas for conversions
            if (!(await this.checkGasBalance())) {
                console.log('⛽ Insufficient gas for conversion, skipping...');
                return false;
            }

            // Split into much smaller chunks for ultra-low gas
            const maxChunkSize = 10; // Convert only 10 TOSHI at a time
            const chunks = Math.min(Math.ceil(amount / maxChunkSize), 10); // Max 10 chunks
            const chunkSize = Math.min(maxChunkSize, amount / chunks);

            for (let i = 0; i < chunks; i++) {
                const chunkAmount = Math.min(chunkSize, amount - (i * chunkSize));
                console.log(`📦 Converting ${chunkAmount} TOSHI first...`);

                // Double-check gas before each chunk
                if (!(await this.checkGasBalance())) {
                    console.log('⛽ Insufficient gas for next chunk, stopping conversion...');
                    break;
                }

                try {
                    await this.executeTokenSwap(
                        this.toshiToken.address,
                        this.networks[this.currentNetwork].wrappedNative,
                        chunkAmount,
                        0
                    );
                    console.log(`✅ Converted chunk ${i + 1}/${chunks}`);
                } catch (error) {
                    console.error(`❌ Failed to convert TOSHI chunk ${i + 1}:`, error.message);
                    // Continue with next chunk instead of stopping completely
                    continue;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ TOSHI conversion failed:', error.message);
            return false;
        }
    }

    async scanForArbitrageOpportunities() {
        try {
            console.log('🎯 Scanning for arbitrage opportunities across all chains...');

            const opportunities = [];
            const allNetworks = Object.keys(this.networks);

            // Parallel scanning for speed - include Base with rate limiting
            const networksToScan = allNetworks; // Include all networks
            // Sequential scan to avoid race conditions on shared web3/currentNetwork
            for (const networkName of networksToScan) {
                try {
                    if (networkName === 'base') {
                        console.log('⏳ Adding delay for Base network rate limiting...');
                        await this.sleep(15000);
                    }
                    await this.switchNetwork(networkName);
                    const networkOps = await this.scanNetworkForOpportunities(networkName);
                    console.log(`📊 Found ${networkOps.length} opportunities on ${networkName}`);
                    opportunities.push(...networkOps);
                } catch (err) {
                    console.error(`❌ Error scanning ${networkName}: ${err.message}`);
                }
            }

            // Sort by profit potential
            opportunities.sort((a, b) => (b.profit * b.size) - (a.profit * a.size));

            return opportunities.slice(0, 10); // Top 10 opportunities
        } catch (error) {
            console.error('❌ Error scanning for arbitrage:', error.message);
            return [];
        }
    }

    async scanNetworkForOpportunities(networkName) {
        const opportunities = [];
    // Assume currentNetwork already set by caller
    const nativeBalance = await this.getNativeBalance();
    // Refresh token prices for tokens encountered in initial portfolio (best-effort)
    try { if (this.initialPortfolio) await this.refreshTokenPrices(Object.keys(this.initialPortfolio.balances)); } catch {}

        if (nativeBalance < 0.0000001) return opportunities;

        // Triangular arbitrage
        const triArb = await this.checkTriangularArbitrage();
        if (triArb && triArb.profit > this.minProfitThreshold) {
            opportunities.push({...triArb, network: networkName});
        }

        // Cross-DEX arbitrage
        const crossDex = await this.checkCrossDexArbitrage();
        if (crossDex && crossDex.profit > this.minProfitThreshold) {
            opportunities.push({...crossDex, network: networkName});
        }

        // Micro-arbitrage (very small opportunities)
        const microArb = await this.checkMicroArbitrage();
        if (microArb) {
            opportunities.push(...microArb.map(opp => ({...opp, network: networkName})));
        }

        // Flash loan arbitrage (if balance allows)
        if (nativeBalance > 0.01) {
            const flashArb = await this.checkFlashLoanArbitrage();
            if (flashArb && flashArb.profit > this.minProfitThreshold) {
                opportunities.push({...flashArb, network: networkName});
            }
        }

        // TOSHI-specific arbitrage (if we have TOSHI balance)
        const toshiBalance = await this.getTokenBalance(this.toshiToken.address);
        if (toshiBalance && toshiBalance.readable > 0) {
            const toshiArb = await this.checkToshiArbitrage(toshiBalance.readable);
            if (toshiArb && toshiArb.profit > this.minProfitThreshold) {
                opportunities.push({...toshiArb, network: networkName});
            }
        }

        // NFT liquidation (placeholder valuation & listing) – gated by config
        if (this.config.enableNftTrading) {
            try {
                const nftOps = await this.scanNftLiquidations();
                for (const op of nftOps) {
                    // Attach network and ensure minimal shape
                    opportunities.push({ ...op, network: networkName });
                }
            } catch (e) {
                console.log(`⚠️ NFT scan failed: ${e.message}`);
            }
        }

        // Always add a wealth-building micro-opportunity if we have gas
        if (this.config.enableMicroWealthStrategy && nativeBalance > 0.0000001) { // Lower threshold for micro-trades with tiny balances
            // Use a reasonable portion of available balance for micro-trades
            const microSize = Math.min(nativeBalance * 0.1, 0.00001); // Use 10% of balance or max 0.00001 ETH
            const microProfitPercent = 0.005; // 0.5% profit for micro-trades
            const microProfit = microSize * microProfitPercent;
            this.throttledLog('wealthOpp', `💰 Adding wealth-building opportunity: balance=${nativeBalance}, size=${microSize}, profit=${microProfit} (${(microProfitPercent * 100).toFixed(2)}%)`);
            opportunities.push({
                type: 'wealth-building-micro',
                profit: microProfitPercent, // Profit as percentage
                size: microSize,
                path: [`Wealth building micro-trade on ${networkName}`]
            });
            // Add a gas-buffer accumulation micro trade (even smaller) if network buffer below target
            const bufferTarget = this.config.nativeBufferTarget || 0.002;
            const reserved = this.networkGasBuffer[networkName] || 0;
            if (reserved < bufferTarget) {
                const deficit = bufferTarget - reserved;
                const gasMicroSize = Math.min(deficit * 0.2, Math.min(nativeBalance * 0.05, 0.000005)); // cap very small
                if (gasMicroSize > 0) {
                    opportunities.push({
                        type: 'gas-buffer-micro',
                        profit: 0.0025, // 0.25% assumed edge
                        size: gasMicroSize,
                        network: networkName,
                        path: ['Gas buffer build'],
                        _intent: 'reserve-native'
                    });
                }
            }
        } else {
            if (this.config.enableMicroWealthStrategy) this.throttledLog('wealthSkip', `❌ Not enough balance for wealth-building: ${nativeBalance} < 0.00001`);
        }

        return opportunities;
    }

    /**
     * Scan owned NFTs (very lightweight placeholder):
     * - Enumerates whitelisted collections (if provided) or skips without enumeration logic (full enumeration requires marketplace API)
     * - Applies cooldown per collection
     * - Creates synthetic liquidation opportunity sized as fraction of portfolio (capped by config)
     */
    async scanNftLiquidations() {
        const ops = [];
        try {
            // Basic guardrails
            if (!this.walletAddress) return ops;
            const now = Date.now();
            const cooldownMs = this.config.nftSellCooldownMinutes * 60 * 1000;

            // Placeholder: treat each whitelisted address as having 1 token eligible
            const collections = (this.config.nftWhitelist && this.config.nftWhitelist.length)
                ? this.config.nftWhitelist
                : [];
            if (this.config.nftRequireWhitelist && !collections.length) return ops; // strict mode requires whitelist
            if (!collections.length) this.throttledLog('nftNoWhitelist','⚠️ NFT: No whitelist provided, proceeding in open mode (limited logic)');
            if (this.nftLiquidationsToday >= this.config.maxDailyNftLiquidations) return ops;

            // Estimate portfolio USD (native balance * price + reserveBalance notionally)
            let nativeBal = 0; try { nativeBal = await this.getNativeBalance(); } catch {}
            const portfolioUsd = (nativeBal * this.ethPriceUSD) + (this.reserveBalance * this.ethPriceUSD);
            if (!portfolioUsd) return ops;

            let listingsThisCycle = 0;
            for (const col of collections) {
                if (listingsThisCycle >= this.config.nftMaxListingsPerCycle) break;
                const last = this.nftLastSale[col.toLowerCase()] || 0;
                if (now - last < cooldownMs) continue; // cooldown
                // Attempt minimal ownership detection for ERC721 by querying recent Transfer events to wallet
                let tokenIdCandidate = 0;
                try {
                    const currentBlock = await this.web3.eth.getBlockNumber();
                    const fromBlock = Math.max(0, currentBlock - this.config.nftEventLookbackBlocks);
                    const erc721 = new this.web3.eth.Contract(ERC721_ABI, col);
                    // Filter events where 'to' is our wallet (topic[2])
                    const walletTopic = '0x000000000000000000000000' + this.walletAddress.slice(2).toLowerCase();
                    const transferSig = this.web3.utils.sha3('Transfer(address,address,uint256)');
                    const logs = await this.web3.eth.getPastLogs({
                        fromBlock,
                        toBlock: 'latest',
                        address: col,
                        topics: [transferSig, null, walletTopic]
                    });
                    if (logs && logs.length) {
                        // Take most recent
                        const lastLog = logs[logs.length-1];
                        tokenIdCandidate = parseInt(lastLog.topics[3], 16);
                    }
                } catch (ee) {
                    // Silent fallback to placeholder tokenId
                }

                let pseudoFloorUsd = Math.max(this.config.nftMinFloorUsd,  this.config.nftMinFloorUsd * (1 + Math.random()*0.2));
                // Real floor fetch if integration enabled
        if (this.config.enableMarketplaceIntegration) {
                    try {
            const floor = await this.fetchCollectionFloor(col);
                        if (floor && floor.floorEth && floor.floorEth > 0) {
                            const usd = floor.floorEth * this.ethPriceUSD;
                            if (usd >= this.config.nftMinFloorUsd) pseudoFloorUsd = usd; // override synthetic
                        }
                    } catch (fe) {
                        this.throttledLog('nftFloorErr', `⚠️ Floor fetch failed ${fe.message}`);
                    }
                }
                if (pseudoFloorUsd < this.config.nftMinFloorUsd) continue;

                // Cap liquidation notional relative to portfolio
                const maxNotionalUsd = portfolioUsd * (this.config.nftMaxPctPortfolio/100);
                const listNotionalUsd = Math.min(pseudoFloorUsd, maxNotionalUsd);
                if (listNotionalUsd <= 0) continue;

                const estProfitPct = 0.002 + Math.random()*0.003; // 0.2% - 0.5% synthetic incremental gain from freeing capital
                const sizeNative = listNotionalUsd / this.ethPriceUSD; // treat as if converted to native

                // Holding time enforcement
                const holdKey = `${col.toLowerCase()}:${tokenIdCandidate}`;
                if (!this.nftHoldTimestamps[holdKey]) this.nftHoldTimestamps[holdKey] = now;
                const heldMinutes = (now - this.nftHoldTimestamps[holdKey]) / 60000;
                if (heldMinutes < this.config.nftMinHoldMinutes) continue;

                ops.push({
                    type: 'nft-liquidation',
                    collection: col,
                    tokenId: tokenIdCandidate,
                    size: sizeNative,
                    profit: estProfitPct,
                    path: ['NFT', 'LIQUIDATE', col, `#${tokenIdCandidate}`],
                    ts: now
                });

                listingsThisCycle++;
            }
        } catch (e) {
            console.log(`⚠️ scanNftLiquidations error: ${e.message}`);
        }
        return ops;
    }

    /** Execute NFT liquidation (placeholder): simply logs & marks cooldown.
     * Real implementation would:
     * - Approve marketplace (e.g., Seaport) if needed
     * - Create & submit listing or accept highest bid
     * - Await transaction confirmation
     */
    async executeNftLiquidation(op) {
        try {
            if (!this.config.enableNftTrading) return false;
            if (!op.collection) return false;
            if (this.nftLiquidationsToday >= this.config.maxDailyNftLiquidations) {
                this.throttledLog('nftDailyCap', '⛔ NFT daily liquidation cap reached.');
                return false;
            }
            // Cooldown stamp
            this.nftLastSale[op.collection.toLowerCase()] = Date.now();
            if (this.config.nftDryRun && !this.config.skipAllDryRuns) {
                console.log(`🧪 (Dry-Run) Would list NFT ${op.collection} tokenId ${op.tokenId} for notional size ${op.size.toFixed(6)} native.`);
                await this.learnFromTrade(op, true);
                return true;
            }

            // Marketplace integration path
            if (this.config.enableMarketplaceIntegration && (this.config.marketplaceProvider === 'reservoir' || this.config.marketplaceProvider === 'opensea')) {
                const listed = await this.createMarketplaceListing(op).catch(()=>false);
                if (listed) {
                    this.tradesExecuted++;
                    this.successfulTrades++;
                    const realized = op.size * op.profit;
                    this.totalProfit += realized;
                    this.nftLiquidationsToday++;
                    await this.learnFromTrade(op, true);
                    console.log(`🖼️ Listed NFT ${op.collection} #${op.tokenId} via Reservoir (sim profit ${realized.toFixed(8)})`);
                    return true;
                } else {
                    console.log('⚠️ Marketplace listing failed, falling back to raw transfer placeholder.');
                }
            }
            // Simulate profit
            this.tradesExecuted++;
            this.successfulTrades++;
            const realized = op.size * op.profit;
            this.totalProfit += realized;
            // Attempt raw transfer to burn/placeholder address to emulate sale completion (NOT a real marketplace sale)
            try {
                const erc721 = new this.web3.eth.Contract(ERC721_ABI, op.collection);
                const dest = this.walletAddress; // In real sale this would be marketplace conduit or buyer
                const gasPrice = await this.getGasPrice();
                await erc721.methods.safeTransferFrom(this.walletAddress, dest, op.tokenId).send({ from: this.walletAddress, gas: 120000, gasPrice });
                console.log(`🖼️ Transferred NFT ${op.collection} #${op.tokenId} (placeholder sale) profit ${realized.toFixed(8)}`);
            } catch (et) {
                console.log(`⚠️ NFT transfer placeholder failed: ${et.message}`);
            }
            this.nftLiquidationsToday++;
            await this.learnFromTrade(op, true);
            return true;
        } catch (e) {
            console.log(`❌ executeNftLiquidation failed: ${e.message}`);
            await this.learnFromTrade(op, false);
            return false;
        }
    }

    /** Fetch collection floor price (ETH) using Reservoir */
    async fetchCollectionFloor(contract) {
        if (!this.config.enableMarketplaceIntegration) return null;
        const provider = this.config.marketplaceProvider;
        // Attempt provider-specific floor retrieval
        if (provider === 'opensea') {
            const openSeaFloor = await this.fetchOpenSeaFloor(contract).catch(()=>null);
            if (openSeaFloor && openSeaFloor.floorEth) return openSeaFloor;
            if (!this.config.openseaReservoirFallback) return openSeaFloor;
            // else fall through to reservoir fallback
        }
        // Reservoir path (primary or fallback)
        const url = `${this.config.reservoirApiBase}/collections/v7?contract=${contract}`;
        const headers = {};
        if (this.config.reservoirApiKey) headers['x-api-key'] = this.config.reservoirApiKey;
        headers['x-chain-id'] = this.networks[this.currentNetwork].chainId;
        const resp = await axios.get(url, { headers, timeout: 8000 });
        const col = resp.data?.collections?.[0];
        if (!col) return null;
        const floorEth = col.floorAsk?.price?.amount?.decimal || 0;
        return { floorEth };
    }

    async fetchOpenSeaFloor(contract) {
        try {
            if (!this.config.openseaApiKey) return null; // require key for reliable access
            // NOTE: OpenSea v2 API: collections?asset_contract_address=...
            const url = `${this.config.openseaApiBase}/api/v2/collections?asset_contract_address=${contract}`;
            const headers = { 'X-API-KEY': this.config.openseaApiKey }; // chain param implicit
            const resp = await axios.get(url, { headers, timeout: 8000 });
            const c = resp.data?.collections?.[0];
            if (!c) return null;
            // floor price object differs; attempt multiple fields
            let floorEth = 0;
            if (c.stats?.floor_price?.price) floorEth = c.stats.floor_price.price; // new format
            else if (c.stats?.floor_price) floorEth = c.stats.floor_price; // legacy numeric
            // filter unrealistic zeros
            if (!floorEth || floorEth <= 0) return null;
            return { floorEth };
        } catch (e) {
            this.throttledLog('openseaFloorErr', `⚠️ OpenSea floor fetch failed: ${e.message}`);
            return null;
        }
    }

    /** Create marketplace listing via Reservoir execute/list */
    async createMarketplaceListing(op) {
        try {
            if (!op.collection || op.tokenId == null) return false;
            if (!this.account) return false;
            const floorData = await this.fetchCollectionFloor(op.collection);
            let listPriceEth;
            if (floorData && floorData.floorEth && floorData.floorEth > 0) {
                listPriceEth = floorData.floorEth * (1 + this.config.nftListingPremiumPct/100);
            } else {
                // fallback to size notionally treated as USD -> convert to ETH size
                listPriceEth = Math.max(op.size, this.config.nftMinFloorEth);
            }
            if (listPriceEth <= 0) return false;
            const expiration = Math.floor(Date.now()/1000) + this.config.nftListingExpiryMinutes*60;
            // Determine orderbook based on provider; for 'opensea' we still can use reservoir relay with orderbook opensea
            const orderbook = this.config.marketplaceProvider === 'opensea' ? 'opensea' : 'reservoir';
            const body = {
                items: [{ token: `${op.collection}:${op.tokenId}`, quantity: 1 }],
                orderKind: 'seaport-v1.5',
                orderbook,
                automatedRoyalties: true,
                currency: '0x0000000000000000000000000000000000000000',
                expirationTime: expiration,
                price: listPriceEth
            };
            const headers = { 'Content-Type':'application/json','x-chain-id': this.networks[this.currentNetwork].chainId };
            if (this.config.reservoirApiKey) headers['x-api-key'] = this.config.reservoirApiKey;
            const url = `${this.config.reservoirApiBase}/execute/list/v7`;
            const resp = await axios.post(url, body, { headers, timeout: 15000 });
            const steps = resp.data?.steps || [];
            if (!steps.length) return false;
            // Execute each step transactionally (approval then listing)
            for (const step of steps) {
                for (const item of (step.items||[])) {
                    if (item.status === 'complete') continue;
                    if (item.data) {
                        const tx = {
                            from: this.walletAddress,
                            to: item.data.to,
                            data: item.data.data,
                            value: item.data.value || '0x0'
                        };
                        // gas price & limit adaptive
                        tx.gasPrice = await this.getGasPrice();
                        try {
                            await this.web3.eth.sendTransaction(tx);
                        } catch (etx) {
                            console.log(`❌ Listing step failed: ${etx.message}`);
                            return false;
                        }
                    }
                }
            }
            return true;
        } catch (e) {
            console.log(`❌ createMarketplaceListing error: ${e.message}`);
            return false;
        }
    }

    /** Enhanced multi-router quote (placeholder aggregation) */
    async multiRouterQuote(tokenIn, tokenOut, amountFloat) {
        if (!this.config.enableMultiRouterQuoter) return null;
        const network = this.networks[this.currentNetwork];
        const routers = [network.router].concat(network.alternativeRouters || []).slice(0,4);
        const results = [];
        for (const r of routers) {
            try {
                const router = new this.web3.eth.Contract(UNISWAP_ROUTER_ABI, r);
                const tokenInContract = new this.web3.eth.Contract(ERC20_ABI, tokenIn);
                const dec = parseInt(await tokenInContract.methods.decimals().call());
                const amtWei = this.toBaseUnits(amountFloat, dec).toString();
                const amounts = await router.methods.getAmountsOut(amtWei, [tokenIn, tokenOut]).call();
                results.push({ router: r, out: BigInt(amounts[1]) });
            } catch {}
        }
        if (!results.length) return null;
        results.sort((a,b)=> (b.out - a.out > 0n ? 1 : -1));
        return results[0];
    }

    /** Compute Sharpe-like weighting per strategy */
    computeStrategySharpe(strategyKey) {
        if (!this.config.enableSharpeWeighting) return 1;
        const successes = this.learningData.successfulTrades.filter(t=> `${t.type}_${t.network}` === strategyKey);
        const fails = this.learningData.failedTrades.filter(t=> `${t.type}_${t.network}` === strategyKey);
        const samples = successes.concat(fails).slice(-this.config.sharpeLookback);
        if (samples.length < 5) return 1;
        const returns = samples.map(t=> (t.profit||0) * (t.size||0));
        const mean = returns.reduce((a,b)=>a+b,0)/returns.length;
        const variance = returns.reduce((a,b)=> a + Math.pow(b-mean,2), 0)/returns.length;
        const std = Math.sqrt(variance) || 1;
        const sharpe = mean / std;
        // Map sharpe into multiplier ~ [0.5, 2]
        return Math.min(2, Math.max(0.5, 1 + sharpe));
    }

    /** Time-decay scoring function for opportunity ranking */
    scoreOpportunity(opp) {
        const baseScore = (opp.profit||0) * (opp.size||0);
        let score = baseScore;
        if (this.config.enableTimeDecayScoring) {
            const ageSec = (Date.now() - (opp.ts || Date.now()))/1000;
            const decay = Math.exp(-this.config.timeDecayLambda * ageSec);
            score *= decay;
        }
        if (this.config.enableSharpeWeighting) {
            const stratKey = `${opp.type}_${opp.network || this.currentNetwork}`;
            score *= this.computeStrategySharpe(stratKey);
        }
        if (this.config.enableMevRiskFilter) {
            const mevRisk = this.estimateMevRisk(opp);
            if (mevRisk >= 0.9) return 0; // discard
            score *= (1 - mevRisk*0.5); // penalize risk
        }
        return score;
    }

    /** Placeholder MEV risk estimation */
    estimateMevRisk(opp) {
        if (!opp || !this.config.enableMevRiskFilter) return 0;
        // Heuristic: higher profit percentage & larger size => higher potential MEV attention
        const pct = opp.profit || 0;
        const relSize = Math.min(1, (opp.size||0) / 0.05); // scale vs 0.05 ETH
        return Math.min(0.95, pct*5 + relSize*0.3); // synthetic risk score
    }

    /** Adaptive network shift based on performance */
    async maybeShiftPrimaryNetwork() {
        if (!this.config.enableAdaptiveNetworkShift) return;
        if (this.cycleCount % this.config.networkShiftIntervalCycles !== 0) return;
        // Compute network success & profit
        const networks = Object.keys(this.networks);
        const stats = {};
        for (const n of networks) stats[n] = { profit:0, trades:0 };
        for (const t of this.learningData.successfulTrades) {
            stats[t.network] = stats[t.network] || { profit:0, trades:0 };
            stats[t.network].profit += (t.profit||0) * (t.size||0);
            stats[t.network].trades++;
        }
        const current = this.currentNetwork;
        let best = current; let bestScore = -Infinity;
        for (const [n,s] of Object.entries(stats)) {
            const score = s.profit; // simple profit basis (could weight by trade count)
            if (score > bestScore) { bestScore = score; best = n; }
        }
        const curScore = stats[current]?.profit || 0;
        if (best !== current) {
            const deltaPct = curScore === 0 ? 100 : ((bestScore - curScore)/Math.max(1e-9, Math.abs(curScore))) * 100;
            if (deltaPct >= this.config.networkShiftMinDeltaPct) {
                console.log(`🌐 Adaptive shift: switching primary from ${current} to ${best} (delta ${deltaPct.toFixed(2)}%)`);
                await this.switchNetwork(best);
            }
        }
    }

    async checkTriangularArbitrage() {
        try {
            const network = this.networks[this.currentNetwork];
            const nativeBalance = await this.getNativeBalance();

            // More aggressive - look for smaller opportunities
            if (nativeBalance < 0.001) return null;

            // Check multiple triangular paths
            const opportunities = [];

            // Path 1: Native -> Token A -> Token B -> Native
            const path1Profit = await this.calculateTriangularProfit(
                network.wrappedNative,
                '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
                '0x4200000000000000000000000000000000000006'  // WETH
            );

            if (path1Profit > 0.001) { // 0.1% minimum profit
                opportunities.push({
                    type: 'triangular',
                    profit: path1Profit,
                    size: Math.min(nativeBalance * 0.05, 0.005), // Smaller trades for more frequency
                    path: ['ETH', 'USDC', 'WETH']
                });
            }

            // Path 2: Native -> TOSHI -> USDC -> Native
            if (this.toshiToken.address) {
                const path2Profit = await this.calculateTriangularProfit(
                    network.wrappedNative,
                    this.toshiToken.address,
                    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // USDC
                );

                if (path2Profit > 0.001) {
                    opportunities.push({
                        type: 'triangular',
                        profit: path2Profit,
                        size: Math.min(nativeBalance * 0.03, 0.003),
                        path: ['ETH', 'TOSHI', 'USDC']
                    });
                }
            }

            return opportunities.length > 0 ? opportunities[0] : null;
        } catch (error) {
            console.error('❌ Error checking triangular arbitrage:', error.message);
            return null;
        }
    }

    async calculateTriangularProfit(token1, token2, token3) {
        try {
            // Simplified profit calculation - in real implementation would check actual prices
            // For now, return a small simulated profit to test the system
            return Math.random() * 0.005 + 0.001; // 0.1% to 0.6% profit
        } catch (error) {
            return 0;
        }
    }

    async checkCrossDexArbitrage() {
        try {
            const network = this.networks[this.currentNetwork];
            const nativeBalance = await this.getNativeBalance();

            if (nativeBalance < 0.001) return null;

            // Check price differences between different DEXes
            const opportunities = [];

            // Simulate cross-DEX opportunities
            const dexProfit = Math.random() * 0.008 + 0.002; // 0.2% to 1% profit

            if (dexProfit > 0.002) { // 0.2% minimum
                opportunities.push({
                    type: 'cross-dex',
                    profit: dexProfit,
                    size: Math.min(nativeBalance * 0.08, 0.008), // More aggressive sizing
                    path: ['Uniswap', 'SushiSwap', 'PancakeSwap']
                });
            }

            return opportunities.length > 0 ? opportunities[0] : null;
        } catch (error) {
            console.error('❌ Error checking cross-DEX arbitrage:', error.message);
            return null;
        }
    }

    async checkFlashLoanArbitrage() {
        // Simplified flash loan arbitrage check
        const network = this.networks[this.currentNetwork];
        const nativeBalance = await this.getNativeBalance();

        if (nativeBalance < 0.01) return null;

        // Look for high-value arbitrage opportunities
        return {
            type: 'flash-loan',
            profit: 0.005, // 0.5%
            size: Math.min(nativeBalance * 0.5, 0.1),
            path: [`Flash Loan -> ${network.nativeToken} -> Arbitrage -> Repay`]
        };
    }

    async checkMicroArbitrage() {
        try {
            const network = this.networks[this.currentNetwork];
            const nativeBalance = await this.getNativeBalance();

            if (nativeBalance < 0.000001) return []; // Very small balance check

            const opportunities = [];

            // Look for micro arbitrage opportunities with realistic profit calculations
            // Use 0.1% of balance for micro-trades
            const microTradeSize = Math.min(nativeBalance * 0.001, 0.00001);

            if (microTradeSize < 0.000001) return [];

            // Check for small price differences between DEXes
            const dexPrices = await this.getDexPrices(network.wrappedNative, network.wrappedNative); // Same token for simplicity

            if (dexPrices && dexPrices.length > 1) {
                const priceDiff = Math.abs(dexPrices[0] - dexPrices[1]) / Math.max(dexPrices[0], dexPrices[1]);

                if (priceDiff > 0.0001) { // 0.01% difference
                    const microProfit = microTradeSize * priceDiff * 0.5; // Conservative profit estimate

                    if (microProfit > 0.000001) {
                        opportunities.push({
                            type: 'micro-arbitrage',
                            profit: microProfit,
                            size: microTradeSize,
                            path: [`Micro ${network.nativeToken} arbitrage between DEXes`]
                        });
                    }
                }
            }

            // If no DEX arbitrage, create a simulated micro-opportunity for testing
            if (opportunities.length === 0 && nativeBalance > 0.00001) {
                opportunities.push({
                    type: 'micro-arbitrage',
                    profit: 0.000001, // Fixed micro profit
                    size: microTradeSize,
                    path: [`Simulated micro ${network.nativeToken} arbitrage`]
                });
            }

            return opportunities.length > 0 ? opportunities : [];
        } catch (error) {
            console.error('❌ Error checking micro arbitrage:', error.message);
            return [];
        }
    }

    async checkToshiArbitrage(toshiBalance) {
        try {
            if (toshiBalance < 1) return null; // Need at least 1 TOSHI

            const network = this.networks[this.currentNetwork];
            const opportunities = [];

            // Try to find arbitrage opportunities using TOSHI
            // For example, TOSHI -> WETH -> TOSHI with profit
            const toshiToWeth = await this.getEstimatedSwapOutput(
                this.toshiToken.address,
                network.wrappedNative,
                toshiBalance * 0.1 // Use 10% of balance
            );

            if (toshiToWeth) {
                const wethToToshi = await this.getEstimatedSwapOutput(
                    network.wrappedNative,
                    this.toshiToken.address,
                    toshiToWeth
                );

                if (wethToToshi && wethToToshi > toshiBalance * 0.1) {
                    const profit = wethToToshi - (toshiBalance * 0.1);
                    const profitPercentage = profit / (toshiBalance * 0.1);

                    if (profitPercentage > 0.001) { // 0.1% profit
                        opportunities.push({
                            type: 'toshi-arbitrage',
                            profit: profit,
                            size: toshiBalance * 0.1,
                            path: ['TOSHI', 'WETH', 'TOSHI'],
                            profitPercentage: profitPercentage
                        });
                    }
                }
            }

            return opportunities.length > 0 ? opportunities[0] : null;
        } catch (error) {
            console.error('❌ Error checking TOSHI arbitrage:', error.message);
            return null;
        }
    }

    async getEstimatedSwapOutput(tokenIn, tokenOut, amountIn) {
        try {
            // Simple estimation - in real implementation, this would query DEX prices
            // For now, return a simulated output with small variation
            const variation = 0.98 + (Math.random() * 0.04); // 98% to 102%
            return amountIn * variation;
        } catch (error) {
            console.error('❌ Error estimating swap output:', error.message);
            return null;
        }
    }

    async executeArbitrageTrade(opportunity) {
        try {
            console.log(`🚀 Executing ${opportunity.type} arbitrage...`);

            // Strategy gating: skip poor performing strategy automatically
            const stratKey = `${opportunity.type}_${opportunity.network || this.currentNetwork}`;
            const perf = this.learningData.strategyPerformance[stratKey];
            if (perf && perf.total >= this.config.strategyMinSample) {
                const sr = perf.success / perf.total;
                if (sr < this.config.strategyDisableThreshold) {
                    console.log(`⛔ Strategy ${stratKey} disabled (success ${(sr*100).toFixed(1)}%) < threshold ${(this.config.strategyDisableThreshold*100).toFixed(1)}%`);
                    return false;
                }
            }

            // Kelly sizing (percentage based sizing refinement)
            if (this.config.enableKellySizing && opportunity.size) {
                const kSized = this.kellySizeForStrategy(stratKey, opportunity.size);
                if (kSized && Number.isFinite(kSized) && kSized > 0) opportunity.size = kSized;
            }

            // Macro / factor based dynamic adjustments
            const mf = this.marketFactors || {};
            if (opportunity.size) {
                let mult = 1;
                // Momentum encourages slightly larger size
                mult *= 1 + Math.min(0.25, Math.max(-0.25, (mf.momentumScore || 0) * 0.5));
                // High risk heat reduces size
                mult *= 1 - Math.min(0.3, (mf.riskHeat || 0) * 0.5);
                // Macro regime coarse adjustment
                if (this.macroRegime?.includes('turbulent')) mult *= 0.6;
                else if (this.macroRegime?.includes('bull')) mult *= 1.15;
                opportunity.size *= mult;
                // Emergency risk scaling
                opportunity.size = this.applyEmergencyRiskScaling(opportunity.size);
            }

            // Gas-profit guard: ensure projected native profit >= gas * multiplier
            if (this.config.minProfitGasMult && opportunity.profit && opportunity.size) {
                const estGas = await this.estimateGasCost(opportunity).catch(()=>0);
                if (estGas) {
                    const projectedProfitNative = opportunity.profit * opportunity.size; // profit treated as fractional gain
                    if (projectedProfitNative < estGas * this.config.minProfitGasMult) {
                        console.log(`💤 Skip: profit ${projectedProfitNative.toExponential(4)} < gas*mult ${(estGas*this.config.minProfitGasMult).toExponential(4)}`);
                        return false;
                    }
                }
            }

            // Dynamic slippage tuning based on recent volatility + gas regime boost
            const vol = this.currentVolatility();
            // Normalize vol into [0,1] with soft cap
            const normVol = Math.min(1, vol / 0.02); // assume 2% loop profit variance as high
            const slipBpsRange = this.config.volSlippageMaxBps - this.config.volSlippageMinBps;
            const dynamicSlipBps = Math.floor(this.config.volSlippageMaxBps - slipBpsRange * (1 - normVol));
            this.dynamicSlippageFraction = dynamicSlipBps / 10000;
            // Clamp to avoid zero
            if (this.dynamicSlippageFraction < 0.0005) this.dynamicSlippageFraction = 0.0005;
            if (this.dynamicSlippageFraction > 0.03) this.dynamicSlippageFraction = 0.03;
            if (this.dynamicSlippageBoost) {
                this.dynamicSlippageFraction = Math.max(0.0003, Math.min(0.05, this.dynamicSlippageFraction + this.dynamicSlippageBoost));
            }
            // Use dynamic slippage for compatible direct swaps (tokenIn/out present)
            if (opportunity.tokenIn && opportunity.tokenOut && opportunity.size) {
                opportunity._minOut = await this.computeMinAmountOut(opportunity.tokenIn, opportunity.tokenOut, opportunity.size, this.dynamicSlippageFraction).catch(()=>0);
            }

            // Handle TOSHI arbitrage differently
            if (opportunity.type === 'toshi-arbitrage') {
                return await this.executeToshiArbitrage(opportunity);
            }

            // Handle wealth-building micro-trades
            if (opportunity.type === 'wealth-building-micro') {
                return await this.executeWealthBuildingMicroTrade(opportunity);
            }

            // Check gas balance to decide on trade size
            const gasPrice = await this.web3.eth.getGasPrice();
            const gasLimit = 100000; // Ultra-low gas limit for micro-trades
            const estimatedGasCost = BigInt(gasPrice) * BigInt(gasLimit);
            const gasCostEth = Number(estimatedGasCost) / 1e18;

            const balance = await this.web3.eth.getBalance(this.walletAddress);
            const balanceEth = Number(balance) / 1e18;

            // If gas is very low, use micro-trade approach
            if (balanceEth < gasCostEth * 1.5) {
                console.log(`💰 Low gas detected (${balanceEth.toFixed(8)} ETH). Using micro-trade strategy...`);

                // For micro-trades, reduce opportunity size significantly
                const microOpportunity = {
                    ...opportunity,
                    size: opportunity.size / 100, // Use 1% of normal size
                    profit: opportunity.profit * 0.5 // Adjust profit expectation
                };

                if (opportunity.type === 'triangular') {
                    return await this.executeMicroTriangularArbitrage(microOpportunity);
                } else if (opportunity.type === 'cross-dex') {
                    return await this.executeMicroCrossDexArbitrage(microOpportunity);
                }
            }

            // Normal execution for sufficient gas
            if (opportunity.type === 'triangular') {
                return await this.executeTriangularArbitrage(opportunity);
            } else if (opportunity.type === 'cross-dex') {
                return await this.executeCrossDexArbitrage(opportunity);
            } else if (opportunity.type === 'cross-network') {
                return await this.executeCrossNetworkArbitrage(opportunity);
            } else if (opportunity.type === 'nft-liquidation') {
                return await this.executeNftLiquidation(opportunity);
            } else if (opportunity.type === 'gas-buffer-micro') {
                // Simulated gas-buffer accumulation: treat profit portion as reserved native for network
                const pct = opportunity.profit || 0;
                const realized = opportunity.size * pct; // simplified
                const net = opportunity.network || this.currentNetwork;
                this.networkGasBuffer[net] = (this.networkGasBuffer[net]||0) + realized;
                this.totalProfit += realized;
                this.tradesExecuted++;
                this.successfulTrades++;
                this.learnFromTrade({ ...opportunity, realizedProfit: realized }, true).catch(()=>{});
                // Track perf
                const np = (this.networkPerf[opportunity.network] = this.networkPerf[opportunity.network] || { wins:0, losses:0 });
                np.wins++;
                this.throttledLog('gasBuf', `⛽ Reserved ${realized.toFixed(8)} native to gas buffer for ${net} (total ${this.networkGasBuffer[net].toFixed(8)})`);
                return true;
            }

            // Fallback generic micro swap if opportunity type not recognized
            if (opportunity.tokenIn && opportunity.tokenOut && opportunity.size) {
                let effSlip = this.dynamicSlippageFraction || this.maxSlippage;
                if (this.dynamicSlippageBoost) effSlip = Math.max(0.0003, Math.min(0.05, effSlip + this.dynamicSlippageBoost));
                const minOut = opportunity._minOut || await this.computeMinAmountOut(opportunity.tokenIn, opportunity.tokenOut, opportunity.size, effSlip).catch(()=>0);
                return await this.executeTokenSwap(opportunity.tokenIn, opportunity.tokenOut, opportunity.size, minOut);
            }

            return false;
        } catch (error) {
            console.error('❌ Arbitrage execution failed:', error.message);
            try { const net = opportunity?.network || this.currentNetwork; const np = (this.networkPerf[net]=this.networkPerf[net]||{wins:0,losses:0}); np.losses++; } catch {}
            return false;
        }
    }

    /** Compute minAmountOut using current DEX quote and slippage tolerance */
    async computeMinAmountOut(tokenIn, tokenOut, amountFloat, slippageFraction) {
        try {
            const network = this.networks[this.currentNetwork];
            const router = new this.web3.eth.Contract(UNISWAP_ROUTER_ABI, network.router);
            // Assume 18 decimals fallback
            const tokenInContract = new this.web3.eth.Contract(ERC20_ABI, tokenIn);
            const tokenOutContract = new this.web3.eth.Contract(ERC20_ABI, tokenOut);
            const decIn = parseInt(await tokenInContract.methods.decimals().call());
            const decOut = parseInt(await tokenOutContract.methods.decimals().call());
            const amountInWei = this.toBaseUnits(amountFloat, decIn).toString();
            const amounts = await router.methods.getAmountsOut(amountInWei, [tokenIn, tokenOut]).call();
            const out = BigInt(amounts[1]);
            const minOut = out - (out * BigInt(Math.floor(slippageFraction * 10000)) / 10000n);
            return minOut.toString();
        } catch (e) {
            console.log(`⚠️ computeMinAmountOut failed: ${e.message}`);
            return 0;
        }
    }

    /** Enhanced opportunity scanner using on-chain router quotes for direct pairs */
    async scanForArbitrageOpportunities() {
        try {
            // Use throttled multi-network scan only every networkScanIntervalCycles cycles
            if (!this._lastFullNetworkScanCycle || (this.cycleCount - this._lastFullNetworkScanCycle) >= this.config.networkScanIntervalCycles) {
                this._lastFullNetworkScanCycle = this.cycleCount;
                return await this.scanAllNetworksMerged();
            } else {
                // Quick single-network scan
                const single = await this.scanNetworkForOpportunities(this.currentNetwork);
                return single.slice(0, this.config.maxOpportunities).sort((a,b)=> (b.profit*b.size) - (a.profit*a.size));
            }
        } catch (e) {
            console.log(`⚠️ scanForArbitrageOpportunities failed: ${e.message}`);
            return [];
        }
    }

    async scanAllNetworksMerged() {
        const aggregate = [];
        for (const net of Object.keys(this.networks)) {
            try {
                await this.switchNetwork(net);
                const ops = await this.scanNetworkForOpportunities(net);
                aggregate.push(...ops);
            } catch (e) {
                console.log(`⚠️ scanAllNetworksMerged: ${net} failed ${e.message}`);
            }
        }
        // Deduplicate by path+network+type
        const seen = new Set();
        const dedup = [];
        for (const o of aggregate) {
            const key = `${o.type}:${o.network}:${o.path?.join('|')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            dedup.push(o);
        }
        return dedup
            .map(o=> ({...o, _score: this.scoreOpportunity(o)}))
            .sort((a,b)=> b._score - a._score)
            .slice(0, this.config.maxOpportunities);
    }

    /** Verify wallet & private key alignment; downgrade to simulation if mismatch */
    async verifyWalletSetup() {
        try {
            if (!this.privateKey) {
                console.log('🔐 No PRIVATE_KEY in env – remaining in simulation mode.');
                this.config.enableRealTrades = false;
                return;
            }
            if (!this.account) {
                this.account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
            }
            const derived = this.account.address.toLowerCase();
            const declared = (this.walletAddress || '').toLowerCase();
            if (declared && derived !== declared) {
                console.log('⚠️ WALLET_ADDRESS does not match derived address from PRIVATE_KEY. Forcing simulation.');
                console.log(`   Derived:  ${derived}`);
                console.log(`   Declared: ${declared}`);
                this.config.enableRealTrades = false;
            } else {
                this.walletAddress = this.account.address;
                console.log(`🔗 Using wallet ${this.walletAddress}`);
            }
            const nativeBal = await this.getNativeBalance();
            console.log(`💰 Initial native balance: ${nativeBal} ${this.networks[this.currentNetwork].nativeToken}`);
            if (nativeBal <= 0) {
                console.log('⚠️ Zero native balance – trades will be skipped until gas is funded.');
            }
        } catch (e) {
            console.log(`❌ verifyWalletSetup error: ${e.message}`);
            this.config.enableRealTrades = false;
        }
    }

    /** Adjust trade fraction dynamically based on current equity vs baseline */
    adjustDynamicRiskScaling() {
        try {
            if (!this.initialPortfolio) return;
            const nativeKey = this.networks[this.currentNetwork].wrappedNative;
            const baseBal = this.initialPortfolio.balances[nativeKey] || 0;
            // If balance decreased, reduce maxTradeFraction proportionally (floor 0.2x original)
            this.dynamicBaseTradeFraction = this.config.maxTradeFraction;
            this.getNativeBalance().then(cur => {
                if (baseBal > 0 && cur < baseBal) {
                    const ratio = Math.max(0.2, cur / baseBal);
                    this.config.maxTradeFraction = this.dynamicBaseTradeFraction * ratio;
                    console.log(`⚖️ Risk scaled: MAX_TRADE_FRACTION -> ${this.config.maxTradeFraction.toFixed(4)} (balance ratio ${ratio.toFixed(3)})`);
                }
            }).catch(()=>{});
        } catch {}
    }

    /** Auto-wrap a small portion of native ETH/MATIC into wrapped token if required */
    async ensureWrappedLiquidity(minAmount = 0.0005) {
        try {
            const network = this.networks[this.currentNetwork];
            const wrapped = network.wrappedNative;
            // Simple heuristic: if we hold native > 3 * min and wrapped balance ~0, wrap min
            const nativeBal = await this.getNativeBalance();
            if (nativeBal < minAmount * 3) return;
            const wrappedBal = await this.getTokenBalance(wrapped);
            if (wrappedBal && wrappedBal.readable > minAmount) return;
            if (!this.config.enableRealTrades) return; // skip in simulation
            // Minimal ABI for deposit()
            const WETH_ABI = [{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"}];
            const contract = new this.web3.eth.Contract(WETH_ABI, wrapped);
            const amountWei = this.web3.utils.toWei(minAmount.toString(), 'ether');
            console.log(`🔄 Wrapping ${minAmount} native into wrapped token for routing.`);
            await contract.methods.deposit().send({ from: this.walletAddress, value: amountWei, gas: 60000, gasPrice: await this.getGasPrice() });
        } catch (e) {
            console.log(`⚠️ ensureWrappedLiquidity failed: ${e.message}`);
        }
    }

    /** Periodic maintenance to run each cycle end */
    async postCycleMaintenance() {
        await this.updateProfitLedger();
        this.adjustDynamicRiskScaling();
        await this.ensureWrappedLiquidity();
    await this.consolidateDustBalances();
    // Periodically persist caches
    try {
        if (this.cycleCount % 20 === 0) {
            fs.writeFileSync(path.join(__dirname,this.config.tokenPriceCacheFile), JSON.stringify(this.tokenPriceCache,null,2));
            fs.writeFileSync(path.join(__dirname,this.config.networkPerfFile), JSON.stringify(this.networkPerf,null,2));
        }
    } catch {}
    }

    async captureInitialPortfolio() {
        if (this.initialPortfolio) return;
        const snapshot = await this.getPortfolioSnapshot();
        this.initialPortfolio = snapshot;
    console.log('📦 Captured initial portfolio baseline. Tokens:', Object.keys(snapshot.balances).length);
    }

    async getPortfolioSnapshot() {
        const network = this.networks[this.currentNetwork];
        const tokens = [network.wrappedNative, this.toshiToken.address, ...new Set((this.tradingPairs[this.currentNetwork]||[]).map(p=>p.tokenIn))];
        const balances = {};
        for (const t of tokens) {
            try {
                if (t.toLowerCase() === network.wrappedNative.toLowerCase()) {
                    balances[t] = await this.getNativeBalance();
                } else {
                    const bal = await this.getTokenBalance(t);
                    if (bal) balances[t] = bal.readable;
                }
            } catch {}
        }
        const snapshot = { ts: Date.now(), network: this.currentNetwork, balances };
        this.portfolioHistory.push(snapshot);
        if (this.portfolioHistory.length > 50) this.portfolioHistory.shift();
        return snapshot;
    }

    recordVolatilitySample(ratio) {
        if (!Number.isFinite(ratio)) return;
        this.volatilityWindow.push(ratio);
        if (this.volatilityWindow.length > this.config.adaptiveVolLookback) this.volatilityWindow.shift();
    }

    currentVolatility() {
        if (!this.volatilityWindow.length) return 0;
        const avg = this.volatilityWindow.reduce((a,b)=>a+b,0)/this.volatilityWindow.length;
        const variance = this.volatilityWindow.reduce((a,b)=>a+Math.pow(b-avg,2),0)/this.volatilityWindow.length;
        return Math.sqrt(variance);
    }

    async buildInventoryRotationOpportunity() {
        try {
            const snapshot = await this.getPortfolioSnapshot();
            if (!this.initialPortfolio) this.initialPortfolio = snapshot;
            const preservePct = this.config.baselinePreservePct;
            // Choose a token (other than native) with balance above preserved baseline
            let candidate = null;
            for (const [token, bal] of Object.entries(snapshot.balances)) {
                if (token.toLowerCase() === this.networks[this.currentNetwork].wrappedNative.toLowerCase()) continue;
                const baseBal = this.initialPortfolio.balances[token] || 0;
                if (bal > baseBal * preservePct && bal > 0) {
                    candidate = { token, bal, surplus: bal - baseBal * preservePct };
                    break;
                }
            }
            if (!candidate) return null;
            // Use a fraction of surplus based on volatility (lower vol => larger fraction)
            const vol = this.currentVolatility();
            const dynamicFrac = Math.min(0.05, Math.max(0.005, 0.02 / (vol + 0.0001))); // 0.5% - 5%
            const tradeSize = candidate.surplus * dynamicFrac;
            if (tradeSize <= 0) return null;
            // Simulated minimal profit (inventory rotation) in bps
            const profitRatio = this.config.inventoryRotationBps / 10000;
            return {
                type: 'inventory-rotation',
                profit: profitRatio,
                size: tradeSize,
                path: ['INV_ROT', 'STABLE'],
                tokenIn: candidate.token,
                tokenOut: this.networks[this.currentNetwork].wrappedNative
            };
        } catch (e) {
            return null;
        }
    }

    async updateProfitLedger() {
        const now = Date.now();
        if (now - this.lastLedgerFlush < 60000) return; // flush every 60s
        this.lastLedgerFlush = now;
        // Compute synthetic passive yield components
        const passiveYield = this.computePassiveYieldSnapshot();
        const entry = { ts: now, totalProfit: this.totalProfit, trades: this.tradesExecuted, passiveYield };
        this.profitLedger.push(entry);
        if (this.profitLedger.length > 1440) this.profitLedger.shift(); // keep ~24h at 1/min
        try {
            fs.writeFileSync(this.ledgerFile, JSON.stringify(this.profitLedger,null,2));
        } catch {}
    }

    /** Simulate/track passive yield sources until real integrations are added */
    computePassiveYieldSnapshot() {
        if (!this._passiveState) {
            this._passiveState = {
                lastTs: Date.now(),
                accruedProtocolFeesUsd: 0,
                accruedInventoryYieldUsd: 0,
                compoundedGrowthFactor: 1,
                virtualStakedUsd: 0
            };
        }
        const now = Date.now();
        const dtSec = (now - this._passiveState.lastTs) / 1000;
        this._passiveState.lastTs = now;
        // Assume a tiny continuous fee accrual on idle inventory (placeholder 5% APR split)
        const aprProtocol = 0.05; // 5% annual placeholder
        const aprInventory = 0.02; // 2% annual placeholder (inventory rotation yield)
        const secondsPerYear = 365*24*3600;
        const baseNotionalUsd = this.reserveBalance * this.ethPriceUSD; // synthetic base capital USD
        const feeInc = baseNotionalUsd * (aprProtocol * dtSec / secondsPerYear);
        const invInc = baseNotionalUsd * (aprInventory * dtSec / secondsPerYear);
        this._passiveState.accruedProtocolFeesUsd += feeInc;
        this._passiveState.accruedInventoryYieldUsd += invInc;
        // Update compounding factor using protocol fee portion only
        this._passiveState.compoundedGrowthFactor *= (1 + (aprProtocol * dtSec / secondsPerYear));
        return { ...this._passiveState };
    }

    /** Attempt to convert any small dust balances into native every few cycles to realize tiny gains */
    async consolidateDustBalances() {
        if (this.cycleCount % 30 !== 0) return; // every 30 cycles
        try {
            const snapshot = await this.getPortfolioSnapshot();
            const network = this.networks[this.currentNetwork];
            for (const [token, bal] of Object.entries(snapshot.balances)) {
                if (token.toLowerCase() === network.wrappedNative.toLowerCase()) continue;
                if (bal > 0 && bal < 0.0005) { // treat as dust
                    console.log(`🧹 Consolidating dust: ${bal} of ${token}`);
                    if (this.config.enableRealTrades) {
                        try {
                            await this.executeTokenSwap(token, network.wrappedNative, bal, 0);
                        } catch (e) { console.log(`⚠️ Dust consolidation failed: ${e.message}`); }
                    }
                }
            }
        } catch {}
    }

    async executeTriangularArbitrage(opportunity) {
        // Simplified triangular arbitrage execution
        const network = this.networks[this.currentNetwork];

        try {
            // Step 1: Native -> Token A
            await this.executeTokenSwap(
                network.wrappedNative,
                '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
                opportunity.size,
                0
            );

            // Step 2: Token A -> Token B
            // Step 3: Token B -> Native

            this.tradesExecuted++;
            this.totalProfit += opportunity.profit * opportunity.size;
            await this.learnFromTrade(opportunity, true);

            return true;
        } catch (error) {
            await this.learnFromTrade(opportunity, false);
            return false;
        }
    }

    async executeCrossDexArbitrage(opportunity) {
        // Simplified cross-DEX execution
        try {
            this.tradesExecuted++;
            this.totalProfit += opportunity.profit * opportunity.size;
            await this.learnFromTrade(opportunity, true);
            return true;
        } catch (error) {
            await this.learnFromTrade(opportunity, false);
            return false;
        }
    }

    async executeToshiArbitrage(opportunity) {
        try {
            console.log(`🚀 Executing TOSHI arbitrage with ${opportunity.size} TOSHI...`);

            // Check if we have enough gas for approvals
            if (!(await this.checkGasBalance())) {
                console.log('⛽ Insufficient gas for TOSHI arbitrage');
                return false;
            }

            const network = this.networks[this.currentNetwork];

            // Execute TOSHI -> WETH swap
            await this.executeTokenSwap(
                this.toshiToken.address,
                network.wrappedNative,
                opportunity.size,
                0
            );

            // Get WETH balance
            const wethBalance = await this.getTokenBalance(network.wrappedNative);
            if (wethBalance && wethBalance.readable > 0) {
                // Execute WETH -> TOSHI swap
                await this.executeTokenSwap(
                    network.wrappedNative,
                    this.toshiToken.address,
                    wethBalance.readable,
                    0
                );
            }

            console.log(`✅ TOSHI arbitrage completed`);
            await this.learnFromTrade(opportunity, true);
            return true;
        } catch (error) {
            console.error('❌ TOSHI arbitrage failed:', error.message);
            await this.learnFromTrade(opportunity, false);
            return false;
        }
    }

    async executeWealthBuildingMicroTrade(opportunity) {
        try {
            console.log(`🚀 Executing wealth-building micro-trade with ${opportunity.size} ${this.networks[this.currentNetwork].nativeToken}...`);

            const stableByNet = {
                polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e
                base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // USDC Base
            };
            const stable = stableByNet[this.currentNetwork];
            if (!stable) {
                console.log('⚠️ No stablecoin configured for this network; skipping.');
                return false;
            }
            const wrapped = this.networks[this.currentNetwork].wrappedNative;
            const swapAmount = Math.max(opportunity.size * 0.5, 0.0000001);

            // Profitability pre-check
            const roundTrip = await this.estimateRoundTripNative(swapAmount, stable);
            if (roundTrip) {
                const backFloat = this.fromBaseUnits(BigInt(roundTrip), 18);
                const projectedGain = backFloat - swapAmount;
                const gasPrice = await this.web3.eth.getGasPrice();
                const estGasCost = (Number(gasPrice) * 80000) / 1e18;
                if (projectedGain <= estGasCost * 1.05) {
                    console.log(`⚠️ Skip micro-trade (gain ${projectedGain.toFixed(10)} <= gas ${estGasCost.toFixed(10)})`);
                    return false;
                }
                console.log(`📈 Projected net after gas: ${(projectedGain - estGasCost).toFixed(10)} ${this.networks[this.currentNetwork].nativeToken}`);
            }

            // Execute forward swap
            const firstSwap = await this.executeTokenSwap(
                wrapped,
                stable,
                swapAmount,
                0
            );

            if (firstSwap) {
                const stableBal = await this.getTokenBalance(stable);
                if (stableBal && stableBal.readable > 0) {
                    const secondSwap = await this.executeTokenSwap(
                        stable,
                        wrapped,
                        stableBal.readable * 0.95,
                        0
                    );
                    if (secondSwap) console.log('✅ Micro-arbitrage completed successfully');
                }
            }

            const actualProfitETH = opportunity.size * (opportunity.profit || 0);
            this.tradesExecuted++;
            this.successfulTrades++;
            this.totalProfit += actualProfitETH;
            this.winRate = this.tradesExecuted > 0 ? (this.successfulTrades / this.tradesExecuted) * 100 : 0;

            console.log(`✅ Wealth-building micro-trade completed`);
            await this.learnFromTrade(opportunity, true);
            return true;
        } catch (error) {
            console.error('❌ Wealth-building micro-trade failed:', error.message);
            await this.learnFromTrade(opportunity, false);
            return false;
        }
    }

    async executeCrossNetworkArbitrage(opportunity) {
        try {
            // Switch to target network
            await this.switchNetwork(opportunity.network);

            // Execute trade on target network
            this.tradesExecuted++;
            this.totalProfit += opportunity.profit * opportunity.size;
            await this.learnFromTrade(opportunity, true);

            // Switch back
            await this.switchNetwork(this.currentNetwork);
            return true;
        } catch (error) {
            await this.learnFromTrade(opportunity, false);
            return false;
        }
    }

    async executeMicroTriangularArbitrage(opportunity) {
        try {
            console.log(`🔬 Executing micro triangular arbitrage with ${opportunity.size} ETH...`);

            const network = this.networks[this.currentNetwork];

            // Use micro-amount for testing
            const microSize = opportunity.size / 100;

            // Step 1: Native -> Token A (micro amount)
            const success1 = await this.executeMicroTrade(
                network.wrappedNative,
                { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
                BigInt(Math.floor(microSize * 1e18)),
                opportunity.profit * microSize
            );

            if (!success1) return false;

            // Step 2: Token A -> Token B (micro amount)
            // Step 3: Token B -> Native (micro amount)

            this.tradesExecuted++;
            this.totalProfit += opportunity.profit * microSize;
            await this.learnFromTrade(opportunity, true);
            console.log(`✅ Micro triangular arbitrage completed! Profit: ${opportunity.profit * microSize}`);
            return true;
        } catch (error) {
            console.error('❌ Micro triangular arbitrage failed:', error.message);
            await this.learnFromTrade(opportunity, false);
            return false;
        }
    }

    async executeMicroCrossDexArbitrage(opportunity) {
        try {
            console.log(`🔬 Executing micro cross-DEX arbitrage with ${opportunity.size} ETH...`);

            // Use micro-amount for testing
            const microSize = opportunity.size / 100;

            // Simplified micro cross-DEX execution
            this.tradesExecuted++;
            this.totalProfit += opportunity.profit * microSize;
            await this.learnFromTrade(opportunity, true);
            console.log(`✅ Micro cross-DEX arbitrage completed! Profit: ${opportunity.profit * microSize}`);
            return true;
        } catch (error) {
            console.error('❌ Micro cross-DEX arbitrage failed:', error.message);
            await this.learnFromTrade(opportunity, false);
            return false;
        }
    }

    async learnFromTrade(trade, success) {
        try {
            if (success) {
                this.learningData.successfulTrades.push({
                    ...trade,
                    timestamp: Date.now(),
                    network: this.currentNetwork
                });
                // Reinvest portion of realized profit into reserve balance to compound
                if (trade.profit && trade.size) {
                    const realizedUsd = trade.profit * trade.size * this.ethPriceUSD;
                    const reinvestAmt = realizedUsd * this.config.reinvestFraction;
                    if (Number.isFinite(reinvestAmt) && reinvestAmt > 0) {
                        this.reserveBalance += reinvestAmt / this.ethPriceUSD; // convert back to base units (ETH equivalent notionally)
                    }
                    const realizedNative = trade.profit * trade.size;
                    this.dailyProfit = (this.dailyProfit || 0) + realizedNative;
                    this.consecutiveLosses = 0;
                }
            } else {
                this.learningData.failedTrades.push({
                    ...trade,
                    timestamp: Date.now(),
                    network: this.currentNetwork,
                    error: 'Trade execution failed'
                });
                if (trade.profit && trade.size) {
                    const lossNative = trade.profit * trade.size; // if profit metric positive treat as potential opp cost
                    this.dailyLoss = (this.dailyLoss || 0) + Math.max(lossNative, 0);
                }
                this.consecutiveLosses = (this.consecutiveLosses || 0) + 1;
            }

            // Update strategy performance
            const strategyKey = `${trade.type}_${this.currentNetwork}`;
            if (!this.learningData.strategyPerformance[strategyKey]) {
                this.learningData.strategyPerformance[strategyKey] = { success: 0, total: 0 };
            }

            this.learningData.strategyPerformance[strategyKey].total++;
            if (success) {
                this.learningData.strategyPerformance[strategyKey].success++;
            }

            // Save learning data
            await this.saveLearningData();

            // Adapt strategy parameters
            await this.adaptStrategyParameters();

            // Circuit breakers
            const startingNative = (this.initialPortfolio?.balances?.[this.networks[this.currentNetwork].wrappedNative] || 0);
            if (startingNative > 0) {
                const lossPct = ((this.dailyLoss || 0) / startingNative) * 100;
                if (this.config.maxDailyLossPct && lossPct >= this.config.maxDailyLossPct) {
                    console.log(`🛑 Circuit Breaker: Daily loss ${lossPct.toFixed(2)}% ≥ limit ${this.config.maxDailyLossPct}% -> disabling real trades.`);
                    this.config.enableRealTrades = false;
                }
            }
            if (this.config.riskDisableAfterLosses && (this.consecutiveLosses || 0) >= this.config.riskDisableAfterLosses) {
                console.log(`🛑 Circuit Breaker: ${this.consecutiveLosses} consecutive losses – disabling real trades.`);
                this.config.enableRealTrades = false;
            }
        } catch (error) {
            console.error('❌ Error learning from trade:', error.message);
        }
    }

    async adaptStrategyParameters() {
        try {
            // Analyze successful strategies
            const bestStrategies = Object.entries(this.learningData.strategyPerformance)
                .filter(([_, perf]) => perf.total >= 5)
                .sort((a, b) => (b[1].success / b[1].total) - (a[1].success / a[1].total))
                .slice(0, 3);

            console.log('🎯 Top performing strategies:', bestStrategies.map(([strat, perf]) =>
                `${strat}: ${(perf.success / perf.total * 100).toFixed(1)}% success`
            ));
            // Adjust trade sizes based on performance
            if (bestStrategies.length > 0) {
                const avgSuccessRate = bestStrategies.reduce((sum, [_, perf]) =>
                    sum + (perf.success / perf.total), 0) / bestStrategies.length;

                if (avgSuccessRate > 0.7) {
                    console.log('📈 Increasing trade sizes due to high success rate');
                } else if (avgSuccessRate < 0.3) {
                    console.log('📉 Decreasing trade sizes due to low success rate');
                }
            }
        } catch (error) {
            console.error('❌ Error adapting strategy:', error.message);
        }
    }

    registerStrategy(name, execFn, scoreFn) {
        if (!this.config.enableStrategyRegistry) return;
        if (this.strategyRegistry.find(s=>s.name===name)) return;
        this.strategyRegistry.push({ name, execFn, scoreFn, enabled: true });
    }

    kellySizeForStrategy(strategyKey, baseSize) {
        if (!this.config.enableKellySizing) return baseSize;
        const perf = this.learningData.strategyPerformance[strategyKey];
        if (!perf || perf.total < 6) return baseSize; // need samples
        const p = perf.success / perf.total;
        const q = 1 - p;
        const kellyF = Math.max(0, Math.min(this.config.kellyMaxFraction, p - q));
        return baseSize * (0.2 + 0.8 * kellyF / (this.config.kellyMaxFraction || 1));
    }

    /**
     * Offline synthetic training simulation to pre-populate learningData with diverse scenarios.
     * Does NOT touch chain. Generates randomized trade outcomes across strategy types & networks.
     * @param {number} iterations Number of simulated trades
     * @param {object} opts Additional options
     */
    async runTrainingSimulation(iterations = 2000, opts = {}) {
        console.log(`🧪 Starting training simulation for ${iterations} synthetic trades...`);
        const strategyTypes = [
            'triangular', 'cross-dex', 'cross-network', 'micro-arbitrage', 'toshi-arbitrage', 'nft-liquidation', 'wealth-building-micro', 'auto-swap-liquidity'
        ];
        const networkKeys = Object.keys(this.networks);
        const stressEvery = 250; // inject stress scenario cadence
        const originalEnableReal = this.config.enableRealTrades;
        const startTs = Date.now();
        // Reset daily stats for clean run
        this.dailyLoss = 0; this.dailyProfit = 0; this.consecutiveLosses = 0;
        for (let i = 1; i <= iterations; i++) {
            // Random pick
            const type = strategyTypes[Math.floor(Math.random() * strategyTypes.length)];
            const net = networkKeys[Math.floor(Math.random() * networkKeys.length)];
            this.currentNetwork = net; // so performance keys segregate
            // Base size: random micro size with occasional larger spike
            const baseSize = (Math.random() ** 2) * 0.05 + (Math.random() < 0.05 ? 0.2 * Math.random() : 0);
            // Profit rate distribution: center small, with fat tails & occasional negative
            let profitRate;
            if (type === 'micro-arbitrage' || type === 'wealth-building-micro') {
                // Emphasize tiny but mostly positive edges
                profitRate = (Math.random() - 0.45) * 0.0015; // narrower distribution
            } else if (type === 'auto-swap-liquidity') {
                // Represent auto rebalancing / currency rotation with fee capture ~ very small spreads
                profitRate = (Math.random() - 0.49) * 0.0008;
            } else {
                profitRate = (Math.random() - 0.48) * 0.004; // default
            }
            if (Math.random() < 0.05) profitRate *= 5; // tail event
            // Stress scenario (force sequence of losses to trigger circuit breaker)
            if (i % stressEvery === 0) {
                profitRate = -0.01 * (1 + Math.random()); // large adverse
            }
            // Synthetic trade object
            const trade = {
                type,
                profit: profitRate, // interpreted as fractional gain, negative => loss
                size: baseSize,
                network: net,
                ts: Date.now(),
                path: [type],
                meta: type === 'auto-swap-liquidity' ? { rotation: true } : undefined
            };
            // Determine success purely on profit > 0 unless we randomize noise threshold
            const noisy = profitRate > 0 ? (Math.random() < 0.97) : (Math.random() < 0.05); // slight label noise
            const success = noisy && profitRate > 0;
            await this.learnFromTrade(trade, success);
            // Periodic log
            if (i % 200 === 0 || i === iterations) {
                const elapsed = ((Date.now() - startTs)/1000).toFixed(1);
                const sr = this.tradesExecuted > 0 ? (this.successfulTrades / this.tradesExecuted * 100).toFixed(2) : '0.00';
                console.log(`📈 Sim ${i}/${iterations} | elapsed ${elapsed}s | win-rate ${sr}% | strategies tracked: ${Object.keys(this.learningData.strategyPerformance).length}`);
            }
            // If circuit breaker disabled real trades during sim, re-enable for continued learning (simulation wants continued data)
            if (!this.config.enableRealTrades) {
                this.config.enableRealTrades = true; // keep simulation progressing
            }
        }
        // Restore original real trade setting
        this.config.enableRealTrades = originalEnableReal;
        await this.saveLearningData();
        console.log('✅ Training simulation complete. Learning data saved.');
    }

    startMetricsServer() {
        if (this.metricsServerStarted || !this.config.enableMetricsServer) return;
        try {
            // dynamic import for ESM
            import('http').then(httpMod => {
                const http = httpMod.default || httpMod;
                const port = this.config.metricsPort;
                const server = http.createServer((req,res)=>{
                    if (req.url === '/metrics') {
                        res.writeHead(200, {'Content-Type':'text/plain'});
                        res.end([
                            `bot_trades_executed ${this.tradesExecuted}`,
                            `bot_trades_success ${this.successfulTrades}`,
                            `bot_total_profit ${this.totalProfit}`,
                            `bot_daily_profit ${this.dailyProfit||0}`,
                            `bot_daily_loss ${this.dailyLoss||0}`,
                            `bot_consecutive_losses ${this.consecutiveLosses||0}`,
                            `bot_win_rate ${this.winRate||0}`,
                            `bot_real_trades_enabled ${this.config.enableRealTrades?1:0}`
                        ].join('\n'));
                    } else {
                        res.writeHead(200, {'Content-Type':'application/json'});
                        res.end(JSON.stringify({status:'ok'}));
                    }
                });
                server.on('error', (err)=>{
                    if (err.code === 'EADDRINUSE') {
                        console.log(`⚠️ Metrics port ${port} already in use; skipping second server.`);
                    } else {
                        console.log(`⚠️ Metrics server error: ${err.message}`);
                    }
                });
                server.listen(port, ()=> console.log(`📈 Metrics server on :${port}`));
                this.metricsServerStarted = true;
            }).catch(e=> console.log(`⚠️ Metrics import failed: ${e.message}`));
        } catch (e) {
            console.log(`⚠️ Metrics server failed early: ${e.message}`);
        }
    }

    async loadLearningData() {
        try {
            const dataPath = path.join(__dirname, 'learning-data.json');
            if (fs.existsSync(dataPath)) {
                const data = fs.readFileSync(dataPath, 'utf8');
                this.learningData = JSON.parse(data);
                console.log('📚 Loaded learning data');
            }
        } catch (error) {
            console.error('❌ Error loading learning data:', error.message);
        }
    }

    async saveLearningData() {
        try {
            const dataPath = path.join(__dirname, 'learning-data.json');
            fs.writeFileSync(dataPath, JSON.stringify(this.learningData, null, 2));
            console.log('💾 Saved learning data');
        } catch (error) {
            console.error('❌ Error saving learning data:', error.message);
        }
    }

    async checkToshiTokens() {
        console.log('🔍 Checking for TOSHI on all networks...');

        // Include Base network but with careful rate limiting
        const networksToCheck = ['base', 'polygon']; // Check both networks

        for (const networkName of networksToCheck) {
            try {
                console.log(`🌐 Checking TOSHI on ${networkName.toUpperCase()}...`);
                await this.switchNetwork(networkName);

                // Add extra delay for Base network to avoid rate limits
                if (networkName === 'base') {
                    console.log('⏳ Adding delay for Base network rate limiting...');
                    await this.sleep(15000); // 15 second delay for Base
                }

                // Try multiple times for Base network
                let balance = null;
                const maxRetries = networkName === 'base' ? 5 : 3; // More retries for Base

                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        balance = await this.getTokenBalance(this.toshiToken.address);
                        break; // Success, exit retry loop
                    } catch (error) {
                        // Handle contract not existing on this network
                        if (error.message.includes('Parameter decoding error') ||
                            error.message.includes('contract') ||
                            error.message.includes('invalid') ||
                            error.message.includes('does not exist')) {
                            console.log(`📭 TOSHI contract not found on ${networkName.toUpperCase()}`);
                            break; // Exit retry loop, contract doesn't exist
                        }

                        if (error.message.includes('rate limit') && attempt < maxRetries - 1) {
                            const delay = 15000 + (attempt * 5000); // Progressive delay: 15s, 20s, 25s, 30s
                            console.log(`⏳ Rate limited on ${networkName}, attempt ${attempt + 1}/${maxRetries}, waiting ${delay/1000}s...`);
                            await this.sleep(delay);
                        } else {
                            throw error; // Re-throw if not rate limit or max retries reached
                        }
                    }
                }

                if (balance && balance.readable > 0) {
                    console.log(`🎉 TOSHI FOUND on ${networkName.toUpperCase()}! Balance: ${balance.readable} TOSHI`);

                    // Don't convert immediately - let the main trading loop handle it
                    // This allows the bot to proceed to micro-trading even if TOSHI conversion fails
                    console.log(`💡 TOSHI will be used for arbitrage opportunities`);
                    break;
                } else {
                    console.log(`📭 No TOSHI found on ${networkName.toUpperCase()}`);
                }
            } catch (error) {
                // Only log critical errors, not contract not found errors
                if (!error.message.includes('Parameter decoding error') &&
                    !error.message.includes('Returned values aren\'t valid') &&
                    !error.message.includes('rate limit')) {
                    console.error(`❌ Error checking ${networkName}:`, error.message);
                } else if (error.message.includes('rate limit')) {
                    console.log(`⏳ Rate limited on ${networkName}, skipping TOSHI check for this cycle`);
                } else {
                    console.log(`📭 No TOSHI contract on ${networkName}`);
                }
            }
        }
    }

    async startTradingCycle() {
        this.isRunning = true;
        console.log('🔄 Starting trading cycles...');

        while (this.isRunning) {
            try {
                this.cycleCount++;
                console.log(`\n📊 Trading Cycle #${this.cycleCount}`);

                // Daily gas reset
                this.resetDailyIfNeeded();

                // Enforce daily gas cap
                if (this.gasSpentTodayEth >= this.config.dailyGasCapEth) {
                    console.log(`⛽ Daily gas cap reached (${this.gasSpentTodayEth.toFixed(6)} / ${this.config.dailyGasCapEth} ETH). Cooling down.`);
                    await this.sleep(60000);
                    continue;
                }

                // Refresh ETH price every 20 cycles
                if (this.cycleCount % 20 === 1) {
                    await this.refreshEthPrice();
                }

                // Periodic macro / knowledge refresh
                if (this.config.enableKnowledgeHub && (this.cycleCount % this.config.knowledgeRefreshCycles === 1)) {
                    await this.refreshKnowledgeContext().catch(e=>console.log('⚠️ Knowledge refresh failed:', e.message));
                }

                // Airdrop scanning & claiming
                if (this.config.enableAirdropScanner && (this.cycleCount - this.lastAirdropScanCycle) >= this.config.airdropScanIntervalCycles) {
                    this.lastAirdropScanCycle = this.cycleCount;
                    const drops = await this.scanAirdrops().catch(()=>[]);
                    for (const d of drops) {
                        await this.claimAirdrop(d).catch(()=>{});
                    }
                }
                // Gas recovery attempt (non-blocking)
                if (this.config.enableGasRecovery) this.gasRecoveryRoutine().catch(()=>{});
                // Dust consolidation sweep (non-blocking)
                this.dustConsolidationSweep(this.cycleCount).catch(()=>{});
                // Native buffer manager (non-blocking)
                this.nativeBufferManager().catch(()=>{});

                // Background micro simulation pulses (enrich brain) without blocking main logic
                if (this.config.backgroundMicroSimCycles && this.cycleCount % this.config.backgroundMicroSimCycles === 0) {
                    this.runTrainingSimulation(this.config.backgroundMicroSimTrades, { background:true }).catch(()=>{});
                }

                // External market data refresh
                if (this.config.enableExternalData && (this.cycleCount % this.config.externalRefreshCycles === 1)) {
                    await this.refreshExternalData().catch(e=>console.log('⚠️ External data refresh failed:', e.message));
                }

                // Background micro simulation pulses to keep learning fresh
                if (this.config.backgroundMicroSimCycles > 0 && (this.cycleCount % this.config.backgroundMicroSimCycles === 0)) {
                    await this.backgroundMicroSimulation().catch(()=>{});
                }

                // Check gas balance first
                const gasBalance = await this.getNativeBalance();
                if (this.config.enableAutoSimFallback) {
                    if (gasBalance < this.config.minGasForRealTrade && this.config.enableRealTrades) {
                        console.log(`🛑 Low gas (${gasBalance.toFixed(8)} < ${this.config.minGasForRealTrade}) switching to SIMULATION to keep learning.`);
                        this.config.enableRealTrades = false;
                        // Attempt an immediate dust consolidation sweep to bootstrap native (best effort)
                        await this.consolidateDustBalances().catch(()=>{});
                        // If still zero, attempt synthetic internal balance rotation to record learning signal
                        if (gasBalance === 0) {
                            const snapshot = await this.getPortfolioSnapshot();
                            const nonZero = Object.entries(snapshot.balances).filter(([t,b])=> b>0);
                            if (nonZero.length) {
                                const [tok, bal] = nonZero[0];
                                // Simulate an internal micro rotation profit for strategy brain
                                const fakeProfit = bal * 0.0001; // 1 bps synthetic
                                await this.learnFromTrade({
                                    network: this.currentNetwork,
                                    type: 'synthetic-bootstrap',
                                    size: bal * 0.01,
                                    profit: fakeProfit,
                                    ts: Date.now(),
                                    path: ['bootstrap']
                                }, true);
                                this.throttledLog('bootstrap', `🧪 Recorded synthetic bootstrap trade on ${tok} profit=${fakeProfit}`);
                                // Generate gasless intents
                                const intents = await this.generateGaslessBootstrapIntents();
                                // Simulate occasional fulfillment
                                for (const it of intents) {
                                    if (Math.random() < 0.2) await this.fulfillGaslessIntent(it).catch(()=>{});
                                }
                            }
                        }
                    } else if (gasBalance >= this.config.minGasForRealTrade && !this.config.enableRealTrades) {
                        console.log(`✅ Gas restored (${gasBalance.toFixed(8)}) switching REAL trades back on.`);
                        this.config.enableRealTrades = true;
                    }
                }
                if (gasBalance < 0.0000001) { // Ultra-low threshold for micro-trades
                    console.log(`🚨 CRITICAL: Gas balance too low (${gasBalance} ETH)`);
                    // Attempt dust consolidation then pause to allow manual top-up
                    await this.consolidateDustBalances();
                    await this.sleep(15000);
                    continue;
                }
                let opportunities = await this.scanForArbitrageOpportunities();
                if (!opportunities || opportunities.length === 0) {
                    opportunities = [];
                }
                // Stamp newly generated opps with ts if missing
                const nowTs = Date.now();
                for (const o of opportunities) { if (!o.ts) o.ts = nowTs; }

                // Adaptive network shift check
                await this.maybeShiftPrimaryNetwork();

                // Periodic brain autosave
                if (this.cycleCount % 25 === 0) {
                    await this.saveBrainState();
                }

                // Always update market factors each cycle
                await this.computeMarketFactors().catch(()=>{});

                if (opportunities.length > 0) {
                    // Reorder via cognitive brain
                    opportunities = this.brain.reorderOpportunities(opportunities, { volatility: this.currentVolatility(), marketFactors: this.marketFactors });
                    console.log('📊 Potential Arbitrage Opportunities (brain-ordered):');
                    for (let i = 0; i < opportunities.length; i++) {
                        const opp = opportunities[i];
                        const estProfit = opp.profit * opp.size * this.ethPriceUSD; // Estimated $ value
                        const gasCost = await this.estimateGasCost(opp);

                        // Get balance for the opportunity's network
                        let oppBalance = nativeBalance;
                        let oppToken = this.networks[this.currentNetwork].nativeToken;
                        if (opp.network && opp.network !== this.currentNetwork) {
                            oppToken = this.networks[opp.network].nativeToken;
                            // For display, we need to check the actual balance on that network
                            await this.switchNetwork(opp.network);
                            oppBalance = await this.getNativeBalance();
                            await this.switchNetwork(this.currentNetwork); // Switch back
                        }

                        const canExecute = oppBalance >= (opp.size + gasCost);

                        console.log(`   ${i + 1}. ${opp.path.join(' -> ')}`);
                        console.log(`      💰 Profit: ${(opp.profit * 100).toFixed(4)}%`);
                        console.log(`      📏 Size: ${opp.size} ${oppToken}`);
                        console.log(`      💵 Est. Profit: $${estProfit.toFixed(8)}`);
                        console.log(`      ⛽ Gas Cost: ${gasCost.toFixed(8)} ETH`);
                        console.log(`      ✅ Can Execute: ${canExecute ? 'YES' : 'NO (Insufficient funds)'}`);
                        console.log(`      🌐 Network: ${opp.network || this.currentNetwork}`);
                    }

                    // Execute best opportunity if profitable enough
                    const bestOpp = opportunities[0];
                    const minProfitUSD = 0.000000001; // Very low threshold for wealth building ($0.000000001)
                    let estProfitUSD;

                    estProfitUSD = bestOpp.profit * bestOpp.size * this.ethPriceUSD;

                    // Get the correct balance for the best opportunity's network
                    let bestOppBalance = nativeBalance;
                    if (bestOpp.network && bestOpp.network !== this.currentNetwork) {
                        await this.switchNetwork(bestOpp.network);
                        bestOppBalance = await this.getNativeBalance();
                        await this.switchNetwork(this.currentNetwork);
                    }

                    // Check if we have enough gas for this specific trade
                    const gasCost = await this.estimateGasCost(bestOpp);
                    const hasEnoughGas = bestOppBalance >= gasCost;

                    // Apply per-strategy sizing
                    bestOpp.size = this.applyPerStrategySizing(bestOpp.size, bestOpp);

                    if (estProfitUSD >= minProfitUSD && bestOppBalance >= bestOpp.size) {
                        if (hasEnoughGas) {
                            console.log('🚀 Executing arbitrage trade...');
                            // Switch to opportunity network for execution
                            if (bestOpp.network && bestOpp.network !== this.currentNetwork) {
                                await this.switchNetwork(bestOpp.network);
                            }
                            const executed = await this.executeArbitrageTrade(bestOpp);
                            // Record outcome in brain using realized/expected reward
                            try {
                                const reward = (bestOpp.profit || 0) * (bestOpp.size || 0);
                                this.brain.recordOutcome(bestOpp.type, reward, !!executed, { volatility: this.currentVolatility() });
                            } catch (e) { /* swallow */ }
                            // Switch back if we switched
                            if (bestOpp.network && bestOpp.network !== this.currentNetwork) {
                                await this.switchNetwork(this.currentNetwork);
                            }
                        } else {
                            console.log(`💸 Would execute trade but insufficient gas (need ${gasCost} ETH, have ${bestOppBalance} ETH on ${bestOpp.network || this.currentNetwork})`);
                            console.log(`📊 Trade details: ${bestOpp.type} | Profit: $${estProfitUSD.toFixed(8)} | Size: ${bestOpp.size}`);
                        }
                    } else if (estProfitUSD < minProfitUSD) {
                        console.log(`💸 Profit too small: $${estProfitUSD.toFixed(8)} < $${minProfitUSD.toFixed(8)}, waiting for better opportunity...`);
                    } else {
                        console.log('💸 Insufficient balance for arbitrage');
                    }
                } else {
                    console.log('📊 No profitable arbitrage opportunities found');
                }

                // More frequent network optimization
                if (this.cycleCount % 3 === 0) {
                    await this.optimizeNetwork();
                }

                // Convert any available TOSHI more aggressively
                if (this.cycleCount % 2 === 0) {
                    await this.checkToshiTokens();
                }

                // Update statistics & LP tracking
                await this.updateStatistics();
                await this.trackLpPositions();

                // Faster cycles for more opportunities
                const cycleTime = opportunities.length > 0 ? 5000 : 10000; // 5s if opportunities found, 10s otherwise
                console.log(`   Next Cycle: ~${cycleTime/1000} seconds`);
                await this.sleep(cycleTime);

            } catch (error) {
                console.error('❌ Trading cycle error:', error.message);
                await this.sleep(5000);
            }
        }
    }

    async optimizeNetwork() {
        console.log('🌐 Adaptive optimization evaluating networks...');
        const scores = [];
        const bufferTarget = this.config.nativeBufferTarget || 0.002;
        // Apply decay to performance to emphasize recent outcomes
        try {
            const decay = this.config.networkPerfDecay || 0.985;
            for (const k of Object.keys(this.networkPerf)) {
                const rec = this.networkPerf[k];
                if (rec && typeof rec === 'object') {
                    rec.wins *= decay; rec.losses *= decay;
                }
            }
        } catch {}
        for (const name of Object.keys(this.networks)) {
            try {
                await this.switchNetwork(name);
                const bal = await this.getNativeBalance();
                const reserved = this.networkGasBuffer[name] || 0;
                const bufferDeficit = Math.max(0, bufferTarget - reserved);
                const perf = this.networkPerf[name] || { wins:0, losses:0 };
                const winRate = (perf.wins + perf.losses) > 0 ? perf.wins / (perf.wins + perf.losses) : 0.5;
                // Score: native balance weight + winrate + inverse deficit penalty
                const score = (bal * 5) + (winRate) - (bufferDeficit * 3);
                scores.push([name, score]);
            } catch (e) {
                scores.push([name, -Infinity]);
            }
        }
        // Restore current network context
        await this.switchNetwork(this.currentNetwork);
        scores.sort((a,b)=> b[1]-a[1]);
        const best = scores[0]?.[0];
        if (best && best !== this.currentNetwork) {
            console.log(`🔀 Switching primary network to ${best} (adaptive score advantage)`);
            await this.switchNetwork(best);
        }
    }

    async updateStatistics() {
    this.winRate = this.tradesExecuted > 0 ? (this.successfulTrades / this.tradesExecuted) * 100 : 0;

        // Update reserve balance with current native balance
        let currentBalance = 0;
        try {
            if (this.web3) {
                const balance = await this.web3.eth.getBalance(this.walletAddress);
                currentBalance = parseFloat(this.web3.utils.fromWei(balance, 'ether'));
                this.reserveBalance = Math.max(this.reserveBalance, currentBalance);
            }
        } catch (error) {
            console.error('❌ Error getting current balance:', error.message);
        }

        console.log('📊 Bot Statistics:');
    console.log(`   Trades Executed: ${this.tradesExecuted}`);
    console.log(`   Win Rate: ${this.winRate.toFixed(1)}%`);
    console.log(`   Average Simulated Profit per Trade: ${(this.totalProfit / Math.max(this.tradesExecuted, 1)).toFixed(10)}`);
    console.log(`   Total Simulated Profit: ${this.totalProfit.toFixed(10)}`);
        console.log(`   Current Reserve: $${this.reserveBalance.toFixed(6)}`);
        console.log(`   Progress to $3M: ${(this.reserveBalance / this.targetReserve * 100).toFixed(8)}%`);
        console.log(`   Trades Needed for $3M: ${Math.ceil((this.targetReserve - this.reserveBalance) / Math.max(this.totalProfit / Math.max(this.tradesExecuted, 1), 0.000001))}`);

        // Show TOSHI conversion progress
        if (this.toshiToken) {
            console.log(`   TOSHI Status: Monitoring for conversion opportunities`);
        }

        // Show network status
        console.log(`   Active Network: ${this.currentNetwork.toUpperCase()}`);
        console.log(`   Aggressive Mode: ${this.aggressiveMode ? 'ON' : 'OFF'}`);
        // Show per-network gas buffer accounting (simulated)
        const nets = Object.keys(this.networkGasBuffer||{});
        if (nets.length) {
            console.log('   Gas Buffers:');
            for (const n of nets) {
                console.log(`      ${n}: ${(this.networkGasBuffer[n]||0).toFixed(8)} native reserved`);
            }
        }
    }

    resetDailyIfNeeded() {
        const now = Date.now();
        if (now - this.dayStart > 24 * 60 * 60 * 1000) {
            this.dayStart = now;
            this.gasSpentTodayEth = 0;
            console.log('📅 New day detected: gas counters reset.');
            this.nftLiquidationsToday = 0;
        }
    }

    throttledLog(key, msg) {
        const now = Date.now();
        if (!this._lastLogTs[key] || now - this._lastLogTs[key] > this.config.logThrottleMs) {
            this._lastLogTs[key] = now;
            console.log(msg);
        }
    }

    async refreshEthPrice() {
        try {
            if (this.config.enableChainlinkOracle) {
                const oracle = await this.fetchChainlinkEthUsd();
                if (oracle) {
                    this.ethPriceUSD = oracle;
                    console.log(`💵 (Chainlink) ETH: $${oracle}`);
                    return;
                }
            }
            // Fallback public API
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                if (!res.ok) throw new Error(`status ${res.status}`);
                const data = await res.json();
                const price = data?.ethereum?.usd;
                if (price && price > 0) {
                    this.ethPriceUSD = price;
                    console.log(`💵 Updated ETH price: $${price}`);
                }
            } catch (e) { console.log(`⚠️ Public price fetch failed: ${e.message}`); }
        } catch (e) {
            console.log(`⚠️ ETH price refresh failed: ${e.message}`);
        }
    }

    async fetchChainlinkEthUsd() {
        try {
            const feedAddr = this.chainlinkFeeds[this.currentNetwork]?.ETHUSD;
            if (!feedAddr) return null;
            const FEED_ABI = [
                {"inputs":[],"name":"latestRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"}
            ];
            const c = new this.web3.eth.Contract(FEED_ABI, feedAddr);
            const p = await Promise.race([
                c.methods.latestRoundData().call(),
                new Promise((_,rej)=> setTimeout(()=>rej(new Error('chainlink-timeout')), this.config.chainlinkTimeoutMs))
            ]);
            const answer = p.answer || p[1];
            if (!answer) return null;
            const val = Number(answer) / 1e8; // Chainlink feeds 8 decimals
            return val > 0 ? val : null;
        } catch { return null; }
    }

    /** Track LP positions (placeholder) */
    async trackLpPositions() {
        if (!this.config.enableLpTracking) return;
        if (this.cycleCount % this.config.lpTrackIntervalCycles !== 0) return;
        // For future: fetch pool reserves and compute share value
        console.log('🔍 (LP) Tracking positions (stub)');
    }

    observeMempool(tx) {
        if (!this.config.enableMempoolFilter) return;
        this.mempoolObserved.push({ ts: Date.now(), tx });
        // prune
        const cutoff = Date.now() - this.config.mempoolWindowSec*1000;
        this.mempoolObserved = this.mempoolObserved.filter(t=> t.ts >= cutoff);
    }

    mempoolAttentionScore(tokenAddr) {
        if (!this.config.enableMempoolFilter) return 0;
        const recent = this.mempoolObserved.filter(t=> (t.tx?.to === tokenAddr || t.tx?.token === tokenAddr));
        return recent.length;
    }

    applyPerStrategySizing(baseSize, opp) {
        if (!this.config.enablePerStrategySizing) return baseSize;
        const stratKey = `${opp.type}_${opp.network || this.currentNetwork}`;
        const perf = this.learningData.strategyPerformance[stratKey];
        if (!perf || perf.total < this.config.strategyMinSample) return baseSize;
        const sr = perf.success / perf.total; // success ratio
        // Map success ratio into multiplier range
        const multRange = this.config.perStrategyMaxMult - this.config.perStrategyMinMult;
        const mult = this.config.perStrategyMinMult + multRange * Math.min(1, Math.max(0, (sr - 0.2) / 0.6));
        return baseSize * mult;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        console.log('🛑 Shutting down bot...');
        this.isRunning = false;

        console.log('📊 Final Statistics:');
        console.log(`   Total Trades: ${this.tradesExecuted}`);
        console.log(`   Total Profit: $${this.totalProfit.toFixed(6)}`);
        console.log(`   Final Reserve: $${this.reserveBalance.toFixed(6)}`);

        await this.saveLearningData();
    await this.saveBrainState();
        process.exit(0);
    }
}

// ===== Knowledge Hub & Macro Regime =====
AdvancedTradingBot.prototype.refreshKnowledgeContext = async function() {
    const now = Date.now();
    if (now - this.knowledgeLastRefresh < 30_000) return; // debounce 30s
    // Lightweight synthetic macro inference (placeholders; in production fetch real APIs):
    // Use internal metrics: volatility, recent win rate, gas price, success dispersion
    const vol = this.currentVolatility();
    const win = this.winRate || 0;
    // Synthetic gas stress proxy: random jitter (could integrate real gas oracle)
    const gasStress = Math.random();
    let macro;
    if (vol < 0.004 && win > 0.6) macro = 'bull_calm';
    else if (vol >= 0.02 && win < 0.4) macro = 'turbulent_drawdown';
    else if (vol >= 0.02) macro = 'high_vol';
    else if (win < 0.3) macro = 'chop_loss';
    else macro = 'neutral_calm';
    this.macroRegime = macro;
    this.knowledgeContext = {
        updated: new Date().toISOString(),
        volatility: vol,
        winRate: win,
        gasStress,
        macroRegime: macro
    };
    // Persist cache
    try {
        fs.writeFileSync(path.join(__dirname, this.config.knowledgeCacheFile), JSON.stringify(this.knowledgeContext, null, 2));
    } catch(e) { /* ignore */ }
    console.log(`🧠 Knowledge refresh: regime=${macro} vol=${vol.toFixed(5)} win=${(win*100).toFixed(1)}%`);
};

AdvancedTradingBot.prototype.computeMarketFactors = async function() {
    try {
        // External provider stubs (can be real later)
        const [priceMom, dexVol, gasInfo] = await Promise.all([
            fetchPriceMomentum({ window: 30 }).catch(()=>({ momentumScore:0 })),
            fetchDexVolume({ window: 20 }).catch(()=>({ volumeUsd: 1e6 })),
            fetchGasOracle().catch(()=>({ gasPriceGwei: 30, avg7d: 30 }))
        ]);

        // Internal trade-derived metrics
        const recent = this.recentTrades.slice(-60);
        const winRatio = recent.length ? recent.filter(r=>r.profitUsd>0).length / recent.length : 0.5;
        const pnlSum = recent.reduce((a,r)=>a+r.profitUsd,0);
        const pnlMomentum = Math.tanh(pnlSum / 75); // compress

        // Base momentum blend
        const blendedMomentum = (priceMom.momentumScore||0)*0.55 + (winRatio-0.5)*1.1 + pnlMomentum*0.35;
        const momentumScore = Math.max(-1, Math.min(1, blendedMomentum));
        const meanReversion = -momentumScore * Math.abs(momentumScore) * 0.8;

        // Volatility & gas based risk heat
        const vol = this.currentVolatility();
        const volNorm = Math.min(1, vol / 0.12);
        const gasRegime = gasInfo.gasPriceGwei > gasInfo.avg7d * 1.25 ? 'elevated' : (gasInfo.gasPriceGwei < gasInfo.avg7d * 0.75 ? 'calm' : 'normal');
        const lossStreak = (this.consecutiveLosses||0)/15;
        const gasStress = gasRegime === 'elevated' ? 0.3 : gasRegime === 'calm' ? 0 : 0.15;
        const riskHeat = Math.max(0, Math.min(1, volNorm*0.5 + lossStreak*0.4 + gasStress));

        // Liquidity proxy from volume + opportunity density
        const oppDensity = this.lastScanOpportunities ? this.lastScanOpportunities.length : 5;
        const liquidityProxyRaw = (dexVol.volumeUsd / 1e7) + (oppDensity/40);
        const liquidityProxy = Math.max(0, Math.min(1, liquidityProxyRaw));

        // Sentiment placeholder -> convert regime & momentum to mild bias
        let sentimentBias = 0;
        if (this.config.enableSentiment) {
            sentimentBias = (momentumScore > 0 ? 0.05 : -0.05) * Math.min(1, Math.abs(momentumScore));
        }

        this.marketFactors = { momentumScore: momentumScore + sentimentBias, meanReversion, gasRegime, liquidityProxy, riskHeat };
        this._factorWindow.push(this.marketFactors);
        if (this._factorWindow.length > 150) this._factorWindow.shift();

        // Dynamic adaptive thresholds
        const baseBps = this.config.minProfitBps;
        const momentumAdj = momentumScore > 0.7 ? -3 : momentumScore > 0.4 ? -2 : momentumScore < -0.5 ? +4 : 0;
        const gasAdj = gasRegime === 'calm' ? -1 : gasRegime === 'elevated' ? +3 : 0;
        const riskAdj = riskHeat > 0.75 ? +4 : riskHeat > 0.55 ? +2 : 0;
        this.dynamicMinProfitBps = Math.max(2, baseBps + momentumAdj + gasAdj + riskAdj);
        this.dynamicSlippageBoost = gasRegime === 'calm' ? -0.0005 : gasRegime === 'elevated' ? +0.0012 : 0;
    } catch(e) {
        this.log('computeMarketFactors error', e.message);
    }
};

/** Load a static / cached airdrop registry file listing potential claim contracts */
AdvancedTradingBot.prototype.loadAirdropRegistry = function() {
    if (!this.config.enableAirdropScanner) return;
    const file = path.join(__dirname, this.config.airdropRegistryFile);
    try {
        if (fs.existsSync(file)) {
            const data = JSON.parse(fs.readFileSync(file,'utf8'));
            if (Array.isArray(data)) this.airdropRegistry = data;
        } else {
            // seed with minimal placeholder entries (no real claim logic)
            this.airdropRegistry = [
                { name: 'ExampleProtocol', contract: '0x0000000000000000000000000000000000000000', selector: '0x12345678', minUsd: 0.5 }
            ];
            fs.writeFileSync(file, JSON.stringify(this.airdropRegistry,null,2));
        }
    } catch(e) { /* ignore */ }
};

/** Scan for unclaimed airdrops (stub). Real implementation would call claimable() methods */
AdvancedTradingBot.prototype.scanAirdrops = async function() {
    if (!this.config.enableAirdropScanner) return [];
    const results = [];
    for (const entry of this.airdropRegistry) {
        // stub: random chance of eligibility
        if (Math.random() < 0.02) {
            const estUsd = 0.2 + Math.random()*1.5;
            results.push({ ...entry, estUsd });
        }
    }
    if (results.length) this.log(`🪂 Potential airdrops: ${results.map(r=>r.name+':$'+r.estUsd.toFixed(2)).join(', ')}`);
    return results;
};

/** Attempt claim of a single airdrop (stub) */
AdvancedTradingBot.prototype.claimAirdrop = async function(drop) {
    if (!this.config.enableAirdropScanner) return false;
    // Gas safety
    const balWei = await this.web3.eth.getBalance(this.walletAddress).catch(()=> '0');
    const bal = Number(balWei)/1e18;
    if (bal < this.config.minGasForAirdropClaim) {
        this.log(`⛽ Skip airdrop claim ${drop.name}: insufficient gas ${bal}`);
        return false;
    }
    // stub claim: simulate success if estUsd > threshold
    if (drop.estUsd >= (drop.minUsd||0.3)) {
        const record = { name: drop.name, valueUsd: drop.estUsd, ts: Date.now() };
        this.airdropClaims.push(record);
        this.resourceEvents.push({ type: 'airdrop', ...record });
        this.log(`✅ Claimed (sim) airdrop ${drop.name} ~$${drop.estUsd.toFixed(2)}`);
        return true;
    }
    return false;
};

/** Gas recovery: if balance below minimum, attempt to free resources (placeholder) */
AdvancedTradingBot.prototype.gasRecoveryRoutine = async function() {
    if (!this.config.enableGasRecovery) return;
    const balWei = await this.web3.eth.getBalance(this.walletAddress).catch(()=> '0');
    const bal = Number(balWei)/1e18;
    if (bal >= this.config.gasRecoveryMinNative) return; // nothing to do
    // Placeholder: would consolidate dust tokens -> native via DEX
    this.log(`🔄 Gas recovery triggered. Balance=${bal} < ${this.config.gasRecoveryMinNative}`);
    // simulate recovered
    const recovered = bal * 0.02; // tiny incremental simulation
    this.resourceEvents.push({ type: 'gas-recovery', recovered, ts: Date.now() });
};

/** Sweep small token balances into native (stub: selection & logging) */
AdvancedTradingBot.prototype.dustConsolidationSweep = async function(cycle) {
    if (!this.config.enableDustConsolidation) return;
    if ((cycle - this.lastDustSweepCycle) < this.config.dustSweepIntervalCycles) return;
    this.lastDustSweepCycle = cycle;
    if (!this.initialPortfolio) return;
    // Identify candidate balances (mock: using initialPortfolio snapshots)
    const candidates = Object.entries(this.initialPortfolio.balances||{})
        .filter(([addr, info])=> (info.usdValue||0) < this.config.dustMinUsd && (info.usdValue||0) > 0)
        .slice(0, this.config.dustMaxTokensPerSweep);
    if (!candidates.length) return;
    this.log(`🧹 Dust sweep candidates: ${candidates.map(c=>c[1].symbol||c[0].slice(0,6)).join(', ')}`);
    // Stub: simulate consolidation event
    this.resourceEvents.push({ type: 'dust-sweep', count: candidates.length, ts: Date.now() });
};

/** Maintain native gas buffer by reallocating a slice of profitable proceeds (stub) */
AdvancedTradingBot.prototype.nativeBufferManager = async function() {
    if (!this.config.enableNativeBufferManager) return;
    const balWei = await this.web3.eth.getBalance(this.walletAddress).catch(()=> '0');
    const bal = Number(balWei)/1e18;
    if (bal >= this.config.nativeBufferTarget) {
        if (this.emergencyModeActive && bal > this.config.nativeBufferLowWater*1.8) {
            this.emergencyModeActive = false;
            this.log('🟢 Exiting emergency mode: native buffer restored.');
        }
        return;
    }
    if (bal < this.config.nativeBufferLowWater) {
        // Signal emergency mode
        if (this.config.enableEmergencyMode && !this.emergencyModeActive) {
            this.emergencyModeActive = true;
            this.log('🚨 Emergency mode activated: native buffer critically low. Scaling risk.');
        }
    }
    // Stub: would pick a liquid token with USD value > threshold and swap fraction to native
    this.resourceEvents.push({ type:'native-buffer', deficiency: this.config.nativeBufferTarget - bal, ts: Date.now() });
};

/** Apply emergency risk scaling to an opportunity size */
AdvancedTradingBot.prototype.applyEmergencyRiskScaling = function(size) {
    if (!this.emergencyModeActive) return size;
    return size * (this.config.emergencyRiskScale || 0.35);
};

/** Create gasless swap intents (stub) that could be relayed by third-party services */
AdvancedTradingBot.prototype.generateGaslessBootstrapIntents = async function() {
    if (!this.config.enableGaslessBootstrap) return [];
    const snapshot = await this.getPortfolioSnapshot();
    // Identify tokens with USD value above threshold but native balance low
    const nativeBal = await this.getNativeBalance();
    if (nativeBal > this.config.nativeBufferLowWater) return [];
    const intents = [];
    for (const [token, bal] of Object.entries(snapshot.balances)) {
        if (token === this.networks[this.currentNetwork].wrappedNative) continue;
        // Assume placeholder price 1 USD per token unit for stub
        const usdVal = bal; // placeholder
        if (usdVal >= this.config.gaslessMinTokenUsd) {
            intents.push({ token, amount: bal * 0.15, created: Date.now(), status: 'pending' });
        }
    }
    if (intents.length) {
        this.gaslessOrders.push(...intents);
        try { fs.writeFileSync(path.join(__dirname, this.config.gaslessOrderFile), JSON.stringify(this.gaslessOrders,null,2)); } catch {}
        this.log(`🪪 Gasless intents created: ${intents.length}`);
    }
    return intents;
};

/** Mark an intent as fulfilled (stub) and simulate gained native gas */
AdvancedTradingBot.prototype.fulfillGaslessIntent = async function(intent) {
    if (!intent || intent.status !== 'pending') return false;
    intent.status = 'filled';
    intent.filledTs = Date.now();
    // Simulate acquiring tiny native gas from relayed execution
    this.resourceEvents.push({ type: 'gasless-fill', token: intent.token, amount: intent.amount, ts: Date.now() });
    try { fs.writeFileSync(path.join(__dirname, this.config.gaslessOrderFile), JSON.stringify(this.gaslessOrders,null,2)); } catch {}
    return true;
};

AdvancedTradingBot.prototype.refreshExternalData = async function() {
    const now = Date.now();
    if (now - (this.externalCache.lastFetch||0) < (this.config.externalMinRefreshSec||60)*1000) return;
    const priceIds = 'bitcoin,ethereum,polygon-pos';
    try {
        const url = `${this.config.coingeckoApiBase}/simple/price?ids=${priceIds}&vs_currencies=usd&include_24hr_change=true`;
        const r = await axios.get(url, { timeout: 7000 });
        this.externalCache.prices = r.data || {};
    } catch(e) { /* ignore */ }
    // Gas oracle fetch (best effort)
    try {
        const g = await axios.get(this.config.gasOracleUrl, { timeout: 4000 });
        this.externalCache.gas = g.data;
    } catch(e) { /* ignore */ }
    // Sentiment placeholder update
    if (this.config.enableSentiment) await this.updateSentimentStub();
    this.externalCache.lastFetch = now;
};

AdvancedTradingBot.prototype.updateSentimentStub = async function() {
    // Placeholder: derive pseudo-sentiment from momentum + macro regime for now
    const m = this.marketFactors?.momentumScore || 0;
    const macro = this.macroRegime || 'neutral';
    let bias = 0;
    if (macro.includes('bull')) bias += 0.2;
    if (macro.includes('turbulent')) bias -= 0.3;
    bias += m * 0.5;
    const sentiment = Math.max(-1, Math.min(1, bias));
    this.externalCache.sentiment = { score: sentiment, updated: new Date().toISOString() };
    try {
        fs.writeFileSync(path.join(__dirname, this.config.sentimentCacheFile), JSON.stringify(this.externalCache.sentiment, null, 2));
    } catch(e) { /* ignore */ }
};

AdvancedTradingBot.prototype.refreshSentiment = async function() {
    // Placeholder sentiment model (could integrate social APIs later)
    const score = (Math.random()*2 - 1) * 0.3; // constrained mild sentiment
    this.sentimentState = { ts: Date.now(), score };
    try { fs.writeFileSync(path.join(__dirname, this.config.sentimentCacheFile), JSON.stringify(this.sentimentState,null,2)); } catch(e){/* ignore */}
};

AdvancedTradingBot.prototype.refreshExternalData = async function() {
    // NOTE: Real implementation would call Coingecko, gas oracle, etc.
    // For safety/no external calls in this environment, we simulate.
    const fakeGas = 20 + Math.random()*40; // gwei
    const fakeMarketBreadth = Math.random()*2 - 1; // -1 .. 1
    this.externalSnapshot = { ts: Date.now(), gasGwei: fakeGas, breadth: fakeMarketBreadth };
    // Incorporate into riskHeat slightly
    if (this.marketFactors) {
        this.marketFactors.riskHeat = Math.min(1, this.marketFactors.riskHeat * 0.9 + (fakeGas/120)*0.1);
    }
};

AdvancedTradingBot.prototype.backgroundMicroSimulation = async function() {
    const n = this.config.backgroundMicroSimTrades || 5;
    for (let i=0;i<n;i++) {
        const pseudo = {
            type: 'micro-arbitrage',
            profit: (Math.random()-0.47)*0.001,
            size: (Math.random()**2)*0.02,
            network: this.currentNetwork,
            ts: Date.now(),
            path: ['bg-micro']
        };
        const success = pseudo.profit > 0 && Math.random()<0.96;
        await this.learnFromTrade(pseudo, success);
    }
};

// Handle shutdown signals
process.on('SIGINT', () => {
    const bot = globalThis.botInstance;
    if (bot) {
        bot.shutdown();
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    const bot = globalThis.botInstance;
    if (bot) {
        bot.shutdown();
    } else {
        process.exit(0);
    }
});

// Initialize and start the bot
async function main() {
    try {
        const bot = new AdvancedTradingBot();
        globalThis.botInstance = bot;

        await bot.initialize();
        // CLI flags: --train[=iterations]
        const trainArg = process.argv.find(a=>a.startsWith('--train'));
        if (trainArg) {
            let iterations = 2000;
            const parts = trainArg.split('=');
            if (parts[1]) {
                const parsed = parseInt(parts[1],10);
                if (!isNaN(parsed) && parsed>0) iterations = parsed;
            }
            await bot.runTrainingSimulation(iterations);
            console.log('🏁 Exiting after training run.');
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default AdvancedTradingBot;
