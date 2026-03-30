import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface BeneficiaryDesignation {
  id: string;
  accountHolderId: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  allocationPercentage: number;
  legalDocumentRef?: string;
  createdAt: Date;
  isActive: boolean;
}

@Injectable()
export class BeneficiaryService {
  private readonly logger = new Logger(BeneficiaryService.name);
  private designations = new Map<string, BeneficiaryDesignation[]>();

  designateBeneficiary(params: {
    accountHolderId: string;
    beneficiaryName: string;
    beneficiaryAddress: string;
    allocationPercentage: number;
    legalDocumentRef?: string;
  }): BeneficiaryDesignation {
    const existing = this.designations.get(params.accountHolderId) ?? [];

    // Validate total allocation does not exceed 100%
    const currentTotal = existing
      .filter(d => d.isActive)
      .reduce((sum, d) => sum + d.allocationPercentage, 0);

    if (currentTotal + params.allocationPercentage > 100) {
      throw new Error(
        `Total allocation would exceed 100%. Current: ${currentTotal}%, Adding: ${params.allocationPercentage}%`,
      );
    }

    const designation: BeneficiaryDesignation = {
      id: `ben_${randomBytes(8).toString('hex')}`,
      accountHolderId: params.accountHolderId,
      beneficiaryName: params.beneficiaryName,
      beneficiaryAddress: params.beneficiaryAddress,
      allocationPercentage: params.allocationPercentage,
      legalDocumentRef: params.legalDocumentRef,
      createdAt: new Date(),
      isActive: true,
    };

    existing.push(designation);
    this.designations.set(params.accountHolderId, existing);

    this.logger.log(
      `Beneficiary designated: ${designation.id} for account ${params.accountHolderId} (${params.allocationPercentage}%)`,
    );
    return designation;
  }

  revokeBeneficiary(accountHolderId: string, designationId: string): void {
    const list = this.designations.get(accountHolderId) ?? [];
    const d = list.find(x => x.id === designationId);
    if (!d) throw new Error(`Designation ${designationId} not found`);
    d.isActive = false;
    this.logger.log(`Beneficiary ${designationId} revoked`);
  }

  getBeneficiaries(accountHolderId: string): BeneficiaryDesignation[] {
    return (this.designations.get(accountHolderId) ?? []).filter(d => d.isActive);
  }

  getAllocationSummary(accountHolderId: string): {
    totalAllocated: number;
    unallocated: number;
    beneficiaries: BeneficiaryDesignation[];
  } {
    const beneficiaries = this.getBeneficiaries(accountHolderId);
    const totalAllocated = beneficiaries.reduce((s, d) => s + d.allocationPercentage, 0);
    return { totalAllocated, unallocated: 100 - totalAllocated, beneficiaries };
  }
}
