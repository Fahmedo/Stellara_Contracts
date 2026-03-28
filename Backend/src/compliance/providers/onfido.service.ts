import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateKycVerificationDto } from '../dto/compliance.dto';

@Injectable()
export class OnfidoService {
  private readonly logger = new Logger(OnfidoService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get('ONFIDO_API_URL', 'https://api.onfido.com/v3.6');
    this.apiKey = this.configService.get('ONFIDO_API_KEY');
  }

  async submitVerification(createKycDto: CreateKycVerificationDto): Promise<any> {
    try {
      // Create applicant
      const applicant = await this.createApplicant(createKycDto);
      
      // Submit check based on verification type
      let checkResult;
      switch (createKycDto.verificationType) {
        case 'identity':
          checkResult = await this.createIdentityCheck(applicant.id);
          break;
        case 'document':
          checkResult = await this.createDocumentCheck(applicant.id, createKycDto.documents);
          break;
        case 'address':
          checkResult = await this.createAddressCheck(applicant.id);
          break;
        case 'enhanced_due_diligence':
          checkResult = await this.createEnhancedCheck(applicant.id);
          break;
        default:
          throw new Error('Unsupported verification type');
      }

      return {
        verificationId: checkResult.id,
        applicantId: applicant.id,
        metadata: {
          provider: 'onfido',
          checkId: checkResult.id,
          applicantId: applicant.id,
        },
      };

    } catch (error) {
      this.logger.error(`Onfido verification error: ${error.message}`);
      throw error;
    }
  }

  private async createApplicant(createKycDto: CreateKycVerificationDto): Promise<any> {
    const url = `${this.apiUrl}/applicants`;
    
    const payload = {
      first_name: createKycDto.personalInfo?.firstName,
      last_name: createKycDto.personalInfo?.lastName,
      email: createKycDto.personalInfo?.email,
      dob: createKycDto.personalInfo?.dateOfBirth,
      address: {
        country: createKycDto.personalInfo?.country,
        postcode: createKycDto.personalInfo?.postalCode,
        city: createKycDto.personalInfo?.city,
        lines: [createKycDto.personalInfo?.address],
      },
    };

    const { data } = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers: {
          'Authorization': `Token token=${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })
    );

    return data;
  }

  private async createIdentityCheck(applicantId: string): Promise<any> {
    const url = `${this.apiUrl}/checks`;
    
    const payload = {
      applicant_id: applicantId,
      check_types: ['identity'],
      results_uri: `${this.configService.get('FRONTEND_URL')}/kyc/results`,
    };

    const { data } = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers: {
          'Authorization': `Token token=${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })
    );

    return data;
  }

  private async createDocumentCheck(applicantId: string, documents: string[]): Promise<any> {
    const url = `${this.apiUrl}/checks`;
    
    const payload = {
      applicant_id: applicantId,
      check_types: ['document'],
      results_uri: `${this.configService.get('FRONTEND_URL')}/kyc/results`,
    };

    const { data } = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers: {
          'Authorization': `Token token=${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })
    );

    // Upload documents
    for (const documentUrl of documents) {
      await this.uploadDocument(applicantId, documentUrl);
    }

    return data;
  }

  private async createAddressCheck(applicantId: string): Promise<any> {
    const url = `${this.apiUrl}/checks`;
    
    const payload = {
      applicant_id: applicantId,
      check_types: ['address'],
      results_uri: `${this.configService.get('FRONTEND_URL')}/kyc/results`,
    };

    const { data } = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers: {
          'Authorization': `Token token=${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })
    );

    return data;
  }

  private async createEnhancedCheck(applicantId: string): Promise<any> {
    const url = `${this.apiUrl}/checks`;
    
    const payload = {
      applicant_id: applicantId,
      check_types: ['identity', 'document', 'address', 'enhanced'],
      results_uri: `${this.configService.get('FRONTEND_URL')}/kyc/results`,
    };

    const { data } = await firstValueFrom(
      this.httpService.post(url, payload, {
        headers: {
          'Authorization': `Token token=${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })
    );

    return data;
  }

  private async uploadDocument(applicantId: string, documentUrl: string): Promise<any> {
    const url = `${this.apiUrl}/documents`;
    
    // Download document from URL and upload to Onfido
    const documentData = await this.downloadDocument(documentUrl);
    
    const { data } = await firstValueFrom(
      this.httpService.post(url, documentData, {
        headers: {
          'Authorization': `Token token=${this.apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
      })
    );

    return data;
  }

  private async downloadDocument(url: string): Promise<any> {
    // Implementation for downloading document from URL
    // This would depend on your document storage solution
    return {};
  }

  async processWebhook(payload: any): Promise<any> {
    try {
      // Verify webhook signature
      const signature = payload.headers['x-onfido-signature'];
      const isValid = await this.verifyWebhookSignature(signature, payload.rawBody);
      
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const { resource_type, action, object } = payload.payload;

      if (resource_type === 'check' && action === 'check.completed') {
        const status = this.mapOnfidoStatus(object.status);
        
        return {
          verificationId: object.id,
          status,
          metadata: {
            provider: 'onfido',
            result: object.result,
            breakdown: object.breakdown,
          },
        };
      }

      return null;

    } catch (error) {
      this.logger.error(`Onfido webhook error: ${error.message}`);
      throw error;
    }
  }

  private mapOnfidoStatus(onfidoStatus: string): string {
    const statusMap = {
      'approved': 'approved',
      'rejected': 'rejected',
      'consider': 'requires_review',
      'withdrawn': 'rejected',
    };

    return statusMap[onfidoStatus] || 'pending';
  }

  private async verifyWebhookSignature(signature: string, payload: string): Promise<boolean> {
    // Implement webhook signature verification
    // This would use your webhook secret
    return true;
  }
}
