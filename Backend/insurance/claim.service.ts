import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';
import { Prisma } from '@prisma/client';
import { FraudDetectionService } from './fraud-detection.service';

@Injectable()
export class ClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fraudDetection: FraudDetectionService,
  ) {}

  async createClaim(policyId: string, claimAmount: number) {
    const policy = await this.prisma.insurancePolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }

    const claim = await this.prisma.claim.create({
      data: {
        policyId,
        claimAmount: claimAmount.toString(),
        status: 'PENDING',
      },
    });

    // Automatically analyze for fraud
    const riskScore = await this.fraudDetection.analyzeClaim(claim.id);
    await this.fraudDetection.flagSuspiciousClaim(claim.id, riskScore);

    return claim;
  }

  async assessClaim(claimId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException(`Claim ${claimId} not found`);
    }

    const riskScore = await this.fraudDetection.analyzeClaim(claimId);

    // If risk is too high, don't auto-approve
    if (riskScore >= 70) {
      return this.prisma.claim.update({
        where: { id: claimId },
        data: { status: 'REJECTED' },
      });
    }

    // Simplified automated assessment
    const updatedClaim = await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: 'APPROVED',
        payoutAmount: claim.claimAmount,
      },
    });

    return updatedClaim;
  }

  async payClaim(claimId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException(`Claim ${claimId} not found`);
    }

    const updatedClaim = await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: 'PAID',
      },
    });

    return updatedClaim;
  }

  async getClaimsByPolicy(policyId: string) {
    return this.prisma.claim.findMany({
      where: { policyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
