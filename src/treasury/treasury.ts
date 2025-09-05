import { EventEmitter } from "events";
import { logger } from "../backend/utils/logger";
import { TreasuryAI } from "../ai/treasury-ai";

interface TreasuryConfig {
  aiEnabled: boolean;
  manualOverride: boolean;
  riskTolerance: "low" | "medium" | "high";
  rebalanceThreshold: number;
}

export class Treasury extends EventEmitter {
  private treasuryAI?: TreasuryAI;
  private config: TreasuryConfig = {
    aiEnabled: true,
    manualOverride: false,
    riskTolerance: "medium",
    rebalanceThreshold: 0.05
  };

  constructor(config?: Partial<TreasuryConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.aiEnabled) {
      this.initializeAI();
    }
  }

  private initializeAI(): void {
    this.treasuryAI = new TreasuryAI();
    
    // Listen to AI events
    this.treasuryAI.on("treasury-recommendation", (recommendation) => {
      this.emit("ai-recommendation", recommendation);
    });

    this.treasuryAI.on("portfolio-update", (update) => {
      this.emit("portfolio-updated", update);
    });

    this.treasuryAI.on("strategy-change", (change) => {
      this.emit("strategy-change-recommended", change);
    });
  }

  async start(): Promise<void> {
    logger.info("Starting Treasury system");
    
    if (this.treasuryAI) {
      await this.treasuryAI.start();
      logger.info("Treasury AI system started");
    }
    
    this.emit("started");
  }

  async stop(): Promise<void> {
    logger.info("Stopping Treasury system");
    
    if (this.treasuryAI) {
      await this.treasuryAI.stop();
      logger.info("Treasury AI system stopped");
    }
    
    this.emit("stopped");
  }

  getStatus() {
    return {
      aiEnabled: this.config.aiEnabled,
      manualOverride: this.config.manualOverride,
      portfolioStatus: this.treasuryAI?.getPortfolioStatus() || null,
      riskMetrics: this.treasuryAI?.getRiskMetrics() || null,
      isEmergencyMode: this.treasuryAI?.isEmergencyMode() || false
    };
  }

  setStrategy(strategy: "conservative" | "moderate" | "aggressive" | "emergency"): void {
    if (this.treasuryAI && !this.config.manualOverride) {
      this.treasuryAI.setStrategy(strategy);
      logger.info(`Treasury strategy set to: ${strategy}`);
    } else {
      logger.warn("Cannot set strategy: AI disabled or manual override active");
    }
  }

  enableManualOverride(): void {
    this.config.manualOverride = true;
    logger.info("Manual override enabled - AI recommendations will be suppressed");
    this.emit("manual-override-enabled");
  }

  disableManualOverride(): void {
    this.config.manualOverride = false;
    logger.info("Manual override disabled - AI will resume normal operation");
    this.emit("manual-override-disabled");
  }

  toggleAI(enabled: boolean): void {
    this.config.aiEnabled = enabled;
    if (enabled && !this.treasuryAI) {
      this.initializeAI();
    }
    logger.info(`Treasury AI ${enabled ? "enabled" : "disabled"}`);
    this.emit("ai-toggled", enabled);
  }
}
