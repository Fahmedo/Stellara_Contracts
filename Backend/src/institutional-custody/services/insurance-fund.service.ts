import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { InsuranceCoverageType } from '../dto/custody.dto';

export interface InsuranceClaim {
  id: string;
  coverageType: InsuranceCoverageType;
  claimedAmount: number;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
  filedAt: Date;
  resolvedAt?: Date;
}

export interface InsuranceFund {
  totalCoverage: number;       // USD
  availableReserves: number;   // USD
  coverageTypes: InsuranceCoverageType[];
  policyNumber: string;
  insurer: string;
  expiresAt: Date;
  socCompliant: boolean;       // SOC 2 Type II
  regulatoryLicenses: string[]; // e.g., ['NY_BITLICENSE', 'NYDFS']
}

@Injectable()
export class InsuranceFundService {
  private readonly logger = new Logger(InsuranceFundService.name);

  private fund: InsuranceFund = {
    totalCoverage: 100_000_000, // $100M
    availableReserves: 100_000_000,
    coverageTypes: Object.values(InsuranceCoverageType),
    policyNumber: `STLR-${randomBytes(6).toString('hex').toUpperCase()}`,
    insurer: 'Stellara Institutional Insurance Syndicate',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    socCompliant: true,
    regulatoryLicenses: ['NY_BITLICENSE', 'NYDFS', 'FINCEN_MSB', 'EU_MICA'],
  };

  private claims = new Map<string, InsuranceClaim>();

  getFundStatus(): InsuranceFund & { utilizationRatio: number } {
    const utilized = this.fund.totalCoverage - this.fund.availableReserves;
    return {
      ...this.fund,
      utilizationRatio: utilized / this.fund.totalCoverage,
    };
  }

  fileClaim(params: {
    coverageType: InsuranceCoverageType;
    claimedAmount: number;
    description: string;
  }): InsuranceClaim {
    if (params.claimedAmount > this.fund.availableReserves) {
      throw new Error(
        `Claim amount ${params.claimedAmount} exceeds available reserves ${this.fund.availableReserves}`,
      );
    }

    const claim: InsuranceClaim = {
      id: `claim_${randomBytes(8).toString('hex')}`,
      coverageType: params.coverageType,
      claimedAmount: params.claimedAmount,
      description: params.description,
      status: 'OPEN',
      filedAt: new Date(),
    };

    this.claims.set(claim.id, claim);
    this.logger.log(`Insurance claim filed: ${claim.id}, amount: $${claim.claimedAmount}`);
    return claim;
  }

  processClaim(claimId: string, approved: boolean): InsuranceClaim {
    const claim = this.claims.get(claimId);
    if (!claim) throw new Error(`Claim ${claimId} not found`);

    if (approved) {
      claim.status = 'PAID';
      this.fund.availableReserves -= claim.claimedAmount;
      this.logger.log(`Claim ${claimId} approved and paid: $${claim.claimedAmount}`);
    } else {
      claim.status = 'REJECTED';
    }

    claim.resolvedAt = new Date();
    return claim;
  }

  /**
   * Generate SOC 2 Type II compliance attestation
   */
  generateComplianceAttestation(): {
    attestationId: string;
    socCompliant: boolean;
    licenses: string[];
    coverageAmount: number;
    validUntil: Date;
    hash: string;
  } {
    const payload = JSON.stringify({
      policyNumber: this.fund.policyNumber,
      coverage: this.fund.totalCoverage,
      licenses: this.fund.regulatoryLicenses,
      timestamp: Date.now(),
    });

    return {
      attestationId: `attest_${randomBytes(8).toString('hex')}`,
      socCompliant: this.fund.socCompliant,
      licenses: this.fund.regulatoryLicenses,
      coverageAmount: this.fund.totalCoverage,
      validUntil: this.fund.expiresAt,
      hash: createHash('sha256').update(payload).digest('hex'),
    };
  }

  getClaim(id: string): InsuranceClaim {
    const c = this.claims.get(id);
    if (!c) throw new Error(`Claim ${id} not found`);
    return c;
  }

  listClaims(): InsuranceClaim[] {
    return Array.from(this.claims.values());
  }
}
