export interface CDPHealth {
  cdpId: string;
  collateralRatio: number;
  healthFactor: number;
  collateralValueUsd: number;
  debtValueUsd: number;
  mintedAmount: number;
  status: 'ACTIVE' | 'AT_RISK' | 'LIQUIDATED' | 'CLOSED';
  maxMintable: number;       // max additional synths that can be minted
  safeWithdrawable: number;  // max collateral that can be withdrawn safely
}

export interface PriceData {
  symbol: string;
  price: number;
  twap: number;
  deviation: number; // % deviation from TWAP
  lastUpdated: Date;
  sources: { source: string; price: number; confidence: number }[];
}

export interface PegStatus {
  syntheticSymbol: string;
  currentPrice: number;
  oraclePrice: number;
  pegDeviation: number;  // percentage
  stabilityFee: number;
  isPegged: boolean;     // within 0.5% tolerance
}

export interface LiquidationResult {
  cdpId: string;
  liquidatorId: string | null;
  collateralSeized: number;
  debtRepaid: number;
  penalty: number;
  isPartial: boolean;
  newHealthFactor: number;
}
