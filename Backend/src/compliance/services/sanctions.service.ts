import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { SanctionsCheck } from '../entities/sanctions-check.entity';
import { CreateSanctionsCheckDto } from '../dto/compliance.dto';

@Injectable()
export class SanctionsService {
  private readonly logger = new Logger(SanctionsService.name);

  constructor(
    @InjectRepository(SanctionsCheck)
    private readonly sanctionsCheckRepository: Repository<SanctionsCheck>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async createSanctionsCheck(createSanctionsDto: CreateSanctionsCheckDto): Promise<SanctionsCheck> {
    try {
      const sanctionsCheck = this.sanctionsCheckRepository.create({
        ...createSanctionsDto,
        status: 'pending',
      });

      const savedCheck = await this.sanctionsCheckRepository.save(sanctionsCheck);

      // Perform sanctions screening
      await this.performSanctionsScreening(savedCheck.id);

      this.logger.log(`Sanctions check created for user ${createSanctionsDto.userId}`);
      return savedCheck;

    } catch (error) {
      this.logger.error(`Error creating sanctions check: ${error.message}`);
      throw error;
    }
  }

  private async performSanctionsScreening(checkId: string): Promise<void> {
    try {
      const check = await this.sanctionsCheckRepository.findOne({ where: { id: checkId } });
      
      if (!check) {
        throw new Error('Sanctions check not found');
      }

      // Check against different sanctions lists based on source
      let screeningResult;
      switch (check.listSource) {
        case 'ofac':
          screeningResult = await this.checkOfacList(check.searchCriteria);
          break;
        case 'un':
          screeningResult = await this.checkUnList(check.searchCriteria);
          break;
        case 'eu':
          screeningResult = await this.checkEuList(check.searchCriteria);
          break;
        default:
          screeningResult = await this.checkCustomList(check.searchCriteria);
      }

      // Update check with results
      await this.sanctionsCheckRepository.update(checkId, {
        status: screeningResult.isMatch ? 'match' : 'clear',
        matchScore: screeningResult.score,
        matchDetails: screeningResult.details,
        isPep: screeningResult.isPep,
        requiresReview: screeningResult.requiresReview,
        screeningResults: screeningResult,
      });

    } catch (error) {
      this.logger.error(`Error performing sanctions screening: ${error.message}`);
      await this.sanctionsCheckRepository.update(checkId, {
        status: 'error',
      });
    }
  }

  private async checkOfacList(searchCriteria: any): Promise<any> {
    try {
      // Mock OFAC API call - replace with actual implementation
      const mockResult = {
        isMatch: false,
        score: 0.15,
        isPep: false,
        requiresReview: false,
        details: {
          checkedAt: new Date(),
          listVersion: '2024.1',
          matches: [],
        },
      };

      return mockResult;

    } catch (error) {
      this.logger.error(`OFAC list check error: ${error.message}`);
      throw error;
    }
  }

  private async checkUnList(searchCriteria: any): Promise<any> {
    // Mock UN sanctions list check
    return {
      isMatch: false,
      score: 0.10,
      isPep: false,
      requiresReview: false,
      details: {
        checkedAt: new Date(),
        listVersion: '2024.1',
        matches: [],
      },
    };
  }

  private async checkEuList(searchCriteria: any): Promise<any> {
    // Mock EU sanctions list check
    return {
      isMatch: false,
      score: 0.12,
      isPep: false,
      requiresReview: false,
      details: {
        checkedAt: new Date(),
        listVersion: '2024.1',
        matches: [],
      },
    };
  }

  private async checkCustomList(searchCriteria: any): Promise<any> {
    // Mock custom sanctions list check
    return {
      isMatch: false,
      score: 0.08,
      isPep: false,
      requiresReview: false,
      details: {
        checkedAt: new Date(),
        listVersion: 'custom',
        matches: [],
      },
    };
  }

  async getSanctionsCheck(id: string): Promise<SanctionsCheck> {
    const check = await this.sanctionsCheckRepository.findOne({ where: { id } });
    
    if (!check) {
      throw new Error('Sanctions check not found');
    }

    return check;
  }

  async getUserSanctionsChecks(userId: string): Promise<SanctionsCheck[]> {
    return this.sanctionsCheckRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async reviewSanctionsCheck(
    id: string,
    reviewData: { reviewedBy: string; reviewNotes: string; status: string },
  ): Promise<SanctionsCheck> {
    await this.sanctionsCheckRepository.update(id, {
      status: reviewData.status,
      requiresReview: false,
      reviewedBy: reviewData.reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: reviewData.reviewNotes,
    });

    return this.getSanctionsCheck(id);
  }
}
