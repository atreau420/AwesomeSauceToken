// StrategyBrain: contextual bandit + regime-aware scoring for strategy/opportunity selection
// ESM module

export default class StrategyBrain {
  constructor(options = {}) {
    this.state = { strategies: {}, totalPlays: 0, version: 1 };
    this.ucbC = options.ucbC ?? 1.4;
    this.decay = options.decay ?? 0.0001; // per update exponential decay
    this.maxHistory = options.maxHistory ?? 10000;
    this.regimeKey = options.regimeKey || (() => 'default');
    this.now = () => Date.now();
  }

  _key(strategy, regime) { return `${strategy}::${regime}`; }

  registerStrategy(name) {
    const regime = 'default';
    const k = this._key(name, regime);
    if (!this.state.strategies[k]) {
      this.state.strategies[k] = { n: 0, successes: 0, sumR: 0, sumR2: 0, lastTs: 0, name, regime };
    }
  }

  regimesFor(strategy) {
    return Object.values(this.state.strategies).filter(s => s.name === strategy).map(s => s.regime);
  }

  currentStats(strategy, regime) {
    return this.state.strategies[this._key(strategy, regime)];
  }

  recordOutcome(strategy, reward, success, context = {}) {
    const regime = this.regimeKey(context) || 'default';
    const k = this._key(strategy, regime);
    if (!this.state.strategies[k]) {
      this.state.strategies[k] = { n: 0, successes: 0, sumR: 0, sumR2: 0, lastTs: 0, name: strategy, regime };
    }
    const s = this.state.strategies[k];
    // decay old data softly
    if (this.decay > 0 && s.n > 0) {
      const factor = Math.exp(-this.decay * Math.max(0, (this.now() - s.lastTs) / 1000));
      s.sumR *= factor; s.sumR2 *= factor; s.n *= factor; s.successes *= factor;
    }
    s.n += 1;
    if (success) s.successes += 1;
    s.sumR += reward;
    s.sumR2 += reward * reward;
    s.lastTs = this.now();
    this.state.totalPlays += 1;
    // pruning
    if (this.state.totalPlays % 500 === 0) this._prune();
  }

  _prune() {
    // Remove extremely stale entries beyond maxHistory boundary or negligible weight
    const entries = Object.entries(this.state.strategies);
    if (entries.length <= this.maxHistory) return;
    entries.sort((a,b)=> (a[1].lastTs||0) - (b[1].lastTs||0));
    for (let i = 0; i < entries.length - this.maxHistory; i++) {
      delete this.state.strategies[entries[i][0]];
    }
  }

  ucbValue(s) {
    if (!s || s.n === 0) return Infinity; // force exploration
    const mean = s.sumR / s.n;
    const total = Math.max(1, this.state.totalPlays);
    const bonus = this.ucbC * Math.sqrt(Math.log(total) / s.n);
    return mean + bonus;
  }

  expectedValue(s) {
    if (!s || s.n === 0) return 0;
    return s.sumR / s.n;
  }

  successRate(s) {
    if (!s || s.n === 0) return 0;
    return s.successes / s.n;
  }

  scoreOpportunity(opp, context = {}) {
    const regime = this.regimeKey(context) || 'default';
    const k = this._key(opp.type, regime);
    const stats = this.state.strategies[k];
    const baseRewardEst = (opp.profit || 0) * (opp.size || 0); // naive expected native gain
    const factors = context.marketFactors || {};
    if (!stats || stats.n === 0) {
      // exploration with slight momentum encouragement
      const momentumBoost = (factors.momentumScore || 0) * 0.1;
      return baseRewardEst + 1 + momentumBoost;
    }
    const ucb = this.ucbValue(stats);
    const volFactor = context.volatility != null ? (1 + Math.min(1, context.volatility / 0.02)) : 1;
    const momentum = 1 + Math.min(0.5, Math.max(-0.5, (factors.momentumScore || 0)));
    const riskPenalty = 1 - Math.min(0.4, Math.max(0, (factors.riskHeat || 0)));
    return baseRewardEst + ucb * volFactor * momentum * riskPenalty;
  }

  reorderOpportunities(opps, context = {}) {
    const scored = opps.map(o => ({ o, score: this.scoreOpportunity(o, context) }));
    scored.sort((a,b)=> b.score - a.score);
    return scored.map(s=> s.o);
  }

  toJSON() {
    return { state: this.state, params: { ucbC: this.ucbC, decay: this.decay, maxHistory: this.maxHistory } };
  }

  load(json) {
    if (!json) return;
    if (json.state) this.state = json.state;
    if (json.params) {
      if (typeof json.params.ucbC === 'number') this.ucbC = json.params.ucbC;
      if (typeof json.params.decay === 'number') this.decay = json.params.decay;
      if (typeof json.params.maxHistory === 'number') this.maxHistory = json.params.maxHistory;
    }
  }
}
