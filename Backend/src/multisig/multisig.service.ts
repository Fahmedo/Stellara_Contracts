import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { AddSignatureDto } from './dto/add-signature.dto';
import { ProposalStatus, NotificationType } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MultisigService {
  private readonly logger = new Logger(MultisigService.name);
  private readonly server: StellarSdk.Horizon.Server;
  
  constructor(private readonly prisma: PrismaService) {
    const networkUrl = process.env.STELLAR_NETWORK_URL || 'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(networkUrl);
  }

  async detectMultiSigAccount(accountId: string) {
    try {
      const account = await this.server.loadAccount(accountId);
      
      const thresholds = {
        masterWeight: account.thresholds.master_weight,
        lowThreshold: account.thresholds.low_threshold,
        medThreshold: account.thresholds.med_threshold,
        highThreshold: account.thresholds.high_threshold,
      };

      const signers = account.signers.map(s => ({
        key: s.key,
        weight: s.weight,
        type: s.type
      }));

      if (signers.length <= 1) {
        throw new BadRequestException('Account is not a multi-signature account');
      }

      const multiSig = await this.prisma.multiSigAccount.upsert({
        where: { accountId },
        update: { thresholds, signers },
        create: {
          accountId,
          thresholds,
          signers,
          name: `MultiSig ${accountId.substring(0, 6)}`,
        }
      });

      return multiSig;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error detecting multisig for ${accountId}: ${error.message}`);
      throw new BadRequestException('Failed to detect multi-sig account on Stellar network');
    }
  }

  async createProposal(userId: string, dto: CreateProposalDto) {
    const multiSig = await this.prisma.multiSigAccount.findUnique({
      where: { id: dto.multiSigId }
    });

    if (!multiSig) throw new NotFoundException('MultiSig account not found');

    let txSource = '';
    try {
      const tx = new StellarSdk.Transaction(dto.xdr, process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET);
      txSource = tx.source;
    } catch (e) {
      throw new BadRequestException('Invalid transaction XDR');
    }

    if (txSource !== multiSig.accountId) {
      throw new BadRequestException(`Transaction source account ${txSource} does not match MultiSig account ${multiSig.accountId}`);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

    const proposal = await this.prisma.transactionProposal.create({
      data: {
        multiSigId: multiSig.id,
        creatorId: userId,
        xdr: dto.xdr,
        description: dto.description,
        expiresAt,
        status: ProposalStatus.PENDING
      }
    });

    await this.notifyPendingSigners(proposal.id, multiSig.signers as any[]);

    return proposal;
  }

  async addSignature(proposalId: string, dto: AddSignatureDto) {
    const proposal = await this.prisma.transactionProposal.findUnique({
      where: { id: proposalId },
      include: { multiSig: true, signatures: true }
    });

    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== ProposalStatus.PENDING && proposal.status !== ProposalStatus.READY) {
      throw new BadRequestException(`Proposal is not in a signable state (status: ${proposal.status})`);
    }

    const signers = proposal.multiSig.signers as any[];
    const isSigner = signers.some(s => s.key === dto.signerAddress);
    if (!isSigner) {
      throw new BadRequestException('Address is not an authorized signer for this MultiSig account');
    }

    let baseTx: StellarSdk.Transaction;
    let newTx: StellarSdk.Transaction;
    try {
      const network = process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;
      baseTx = new StellarSdk.Transaction(proposal.xdr, network);
      newTx = new StellarSdk.Transaction(dto.signedXdr, network);
    } catch (e) {
      throw new BadRequestException('Failed to parse XDR');
    }

    const existingSignatures = baseTx.signatures.map(s => s.signature().toString('base64'));
    const newSigs = newTx.signatures.filter(s => !existingSignatures.includes(s.signature().toString('base64')));

    if (newSigs.length === 0) {
      throw new BadRequestException('No new signature found in provided XDR');
    }

    for (const sig of newSigs) {
      try {
        await this.prisma.proposalSignature.create({
          data: {
            proposalId,
            signerAddress: dto.signerAddress,
            signature: sig.signature().toString('base64')
          }
        });
        baseTx.signatures.push(sig);
      } catch (e) {
        this.logger.error(`Failed to record signature for ${dto.signerAddress}`);
      }
    }

    const updatedXdr = baseTx.toEnvelope().toXDR('base64');
    
    await this.prisma.transactionProposal.update({
      where: { id: proposalId },
      data: { xdr: updatedXdr }
    });

    return this.checkAndSubmit(proposalId, updatedXdr, baseTx);
  }

  async checkAndSubmit(proposalId: string, updatedXdr: string, tx: StellarSdk.Transaction) {
    const proposal = await this.prisma.transactionProposal.findUnique({
      where: { id: proposalId },
      include: { multiSig: true, signatures: true }
    });

    if (!proposal) throw new NotFoundException('Proposal not found');

    const signers = proposal.multiSig.signers as any[];
    let currentWeight = 0;
    const thresholds = proposal.multiSig.thresholds as any;
    
    // Simplistic threshold check logic (using medium threshold)
    const requiredThreshold = thresholds.medThreshold || 1;

    // Collect weights based on recorded signatures
    const signedAddresses = [...new Set(proposal.signatures.map(s => s.signerAddress))];
    for (const address of signedAddresses) {
      const s = signers.find(signer => signer.key === address);
      if (s) {
        currentWeight += s.weight;
      }
    }

    if (currentWeight >= requiredThreshold) {
      // Threshold met, ready to submit
      try {
        await this.prisma.transactionProposal.update({
          where: { id: proposalId },
          data: { status: ProposalStatus.READY }
        });

        // Submit to network
        const response = await this.server.submitTransaction(tx);
        
        await this.prisma.transactionProposal.update({
           where: { id: proposalId },
           data: { status: ProposalStatus.SUBMITTED }
        });
        this.logger.log(`Proposal ${proposalId} submitted to network successfully. Hash: ${response.hash}`);
        return { message: 'Proposal submitted successfully', txHash: response.hash };

      } catch (err: any) {
        this.logger.error(`Failed to submit proposal ${proposalId}: ${err.message}`);
        await this.prisma.transactionProposal.update({
           where: { id: proposalId },
           data: { status: ProposalStatus.FAILED }
        });
        throw new BadRequestException('Transaction submission to network failed');
      }
    }

    return { 
      message: 'Signature added successfully. Threshold not yet met.',
      currentWeight,
      requiredThreshold
    };
  }

  async notifyPendingSigners(proposalId: string, signers: any[]) {
    try {
      for (const signer of signers) {
        const user = await this.prisma.user.findFirst({
           where: { walletAddress: signer.key }
        });
        
        if (user) {
          await this.prisma.notification.create({
            data: {
               userId: user.id,
               type: NotificationType.SYSTEM,
               title: 'New MultiSig Proposal',
               message: `You have a new transaction proposal to sign for ${signer.key.substring(0,6)}...`,
               data: { proposalId }
            }
          });
        }
      }
    } catch (e) {
      this.logger.error(`Failed to send notifications for proposal ${proposalId}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredProposals() {
    this.logger.debug('Running cleanup job for expired multi-sig proposals');
    
    try {
      const expired = await this.prisma.transactionProposal.updateMany({
        where: {
          status: { in: [ProposalStatus.PENDING, ProposalStatus.READY] },
          expiresAt: { lt: new Date() }
        },
        data: {
          status: ProposalStatus.EXPIRED
        }
      });

      if (expired.count > 0) {
        this.logger.log(`Marked ${expired.count} transaction proposals as EXPIRED.`);
      }
    } catch (e) {
      this.logger.error('Error in handleExpiredProposals cron job', e);
    }
  }

  async getProposal(proposalId: string) {
    const proposal = await this.prisma.transactionProposal.findUnique({
      where: { id: proposalId },
      include: {
        multiSig: true,
        signatures: true,
        creator: true
      }
    });

    if (!proposal) throw new NotFoundException('Proposal not found');

    // Remove sensitive user data before returning
    const { creator, ...rest } = proposal;
    return {
      ...rest,
      creator: {
        id: creator.id,
        walletAddress: creator.walletAddress
      }
    };
  }
}
