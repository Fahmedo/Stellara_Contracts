import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateKycVerificationDto } from '../dto/compliance.dto';

@Injectable()
export class JumioService {
  private readonly logger = new Logger(JumioService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly apiSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get('JUMIO_API_URL', 'https://netverify.com/api/v4');
    this.apiToken = this.configService.get('JUMIO_API_TOKEN');
    this.apiSecret = this.configService.get('JUMIO_API_SECRET');
  }

  async submitVerification(createKycDto: CreateKycVerificationDto): Promise<any> {
    try {
      const payload = {
        customerInternalId: createKycDto.userId,
        userReference: createKycDto.userId,
        ...this.buildJumioPayload(createKycDto),
      };

      const { data } = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/initiate`, payload, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiToken}:${this.apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        })
      );

      return {
        verificationId: data.id,
        metadata: {
          provider: 'jumio',
          transactionId: data.id,
        },
      };

    } catch (error) {
      this.logger.error(`Jumio verification error: ${error.message}`);
      throw error;
    }
  }

  private buildJumioPayload(createKycDto: CreateKycVerificationDto): any {
    const basePayload = {
      type: this.mapVerificationType(createKycDto.verificationType),
    };

    if (createKycDto.personalInfo) {
      basePayload.personalDetails = {
        firstName: createKycDto.personalInfo.firstName,
        lastName: createKycDto.personalInfo.lastName,
        dob: createKycDto.personalInfo.dateOfBirth,
        country: createKycDto.personalInfo.country,
      };
    }

    return basePayload;
  }

  private mapVerificationType(type: string): string {
    const typeMap = {
      'identity': 'IDENTITY_VERIFICATION',
      'document': 'DOCUMENT_VERIFICATION',
      'address': 'ADDRESS_VERIFICATION',
      'enhanced_due_diligence': 'ENHANCED_DUE_DILIGENCE',
    };

    return typeMap[type] || 'IDENTITY_VERIFICATION';
  }

  async processWebhook(payload: any): Promise<any> {
    try {
      const { verificationId, verificationStatus } = payload;
      
      return {
        verificationId,
        status: this.mapJumioStatus(verificationStatus),
        metadata: {
          provider: 'jumio',
          payload,
        },
      };

    } catch (error) {
      this.logger.error(`Jumio webhook error: ${error.message}`);
      throw error;
    }
  }

  private mapJumioStatus(jumioStatus: string): string {
    const statusMap = {
      'APPROVED_VERIFIED': 'approved',
      'REJECTED': 'rejected',
      'PENDING_MANUAL_REVIEW': 'requires_review',
      'FAILED': 'rejected',
    };

    return statusMap[jumioStatus] || 'pending';
  }
}
