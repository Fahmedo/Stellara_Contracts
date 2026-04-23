import { Controller, Get, Post, Param, NotFoundException, UseGuards, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { PrismaService } from '../prisma.service';
import { ReputationAccessService } from './services/reputation-access.service';
import { REPUTATION_THRESHOLDS } from './guards/reputation.guard';

@ApiTags('Reputation')
@Controller('users')
export class ReputationController {
  constructor(
    private readonly reputationService: ReputationService,
    private readonly prisma: PrismaService,
    private readonly reputationAccessService: ReputationAccessService,
  ) {}

  @Get(':id/reputation')
  @ApiOperation({ summary: 'Get current reputation for user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Reputation payload returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getReputation(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reputation = await this.reputationService.getReputation(id);
    return {
      userId: id,
      reputation,
    };
  }

  @Get(':id/reputation/history')
  @ApiOperation({ summary: 'Get historical reputation entries for user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Reputation history returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getReputationHistory(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const history = await this.reputationService.getReputationHistory(id);
    return {
      userId: id,
      history,
    };
  }

  @Post(':id/reputation/recalculate')
  @ApiOperation({ summary: 'Recalculate user reputation score' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 201, description: 'Reputation recalculated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async recalculateReputation(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const breakdown = await this.reputationService.updateReputationScore(id);
    return {
      userId: id,
      message: 'Reputation recalculated successfully',
      breakdown,
    };
  }

  @Get(':id/reputation/decay-history')
  @ApiOperation({ summary: 'Get reputation decay history for user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Decay history returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getDecayHistory(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const decayHistory = await this.reputationService.getDecayHistory(id);
    return {
      userId: id,
      decayHistory,
    };
  }

  @Get(':id/reputation/access')
  @ApiOperation({ summary: 'Get user reputation-based access and features' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User access information returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserAccess(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const access = await this.reputationAccessService.getUserAccess(id);
    return {
      userId: id,
      access,
    };
  }

  @Get(':id/reputation/check-premium')
  @ApiOperation({ summary: 'Check if user can access premium features' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Premium access check result' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async checkPremiumAccess(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const canAccess = await this.reputationAccessService.canAccessPremium(id);
    return {
      userId: id,
      canAccessPremium: canAccess,
      requiredScore: REPUTATION_THRESHOLDS.PREMIUM_ACCESS,
      currentScore: user.reputationScore,
    };
  }

  @Get(':id/reputation/check-governance')
  @ApiOperation({ summary: 'Check if user can participate in governance' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Governance eligibility check result' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async checkGovernanceEligibility(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const canParticipate = await this.reputationAccessService.canParticipateInGovernance(id);
    return {
      userId: id,
      canParticipateInGovernance: canParticipate,
      requiredScore: REPUTATION_THRESHOLDS.GOVERNANCE_PARTICIPATION,
      currentScore: user.reputationScore,
    };
  }

  @Get(':id/reputation/funding-limit')
  @ApiOperation({ summary: 'Get dynamic funding limit based on reputation' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Funding limit returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getFundingLimit(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const fundingLimit = this.reputationAccessService.calculateFundingLimit(user.reputationScore);
    return {
      userId: id,
      reputationScore: user.reputationScore,
      maxFundingLimit: fundingLimit,
      accessLevel: this.reputationAccessService.getAccessLevel(user.reputationScore),
    };
  }

  @Get('reputation/thresholds')
  @ApiOperation({ summary: 'Get all reputation thresholds and requirements' })
  @ApiResponse({ status: 200, description: 'Reputation thresholds returned' })
  async getReputationThresholds() {
    return {
      thresholds: REPUTATION_THRESHOLDS,
      description: {
        BASIC_ACCESS: 'Default access level for all users',
        ENHANCED_ACCESS: 'Access to enhanced analytics and priority support',
        PREMIUM_ACCESS: 'Access to premium features and advanced tools',
        GOVERNANCE_PARTICIPATION: 'Eligible to participate in governance voting',
        ELITE_ACCESS: 'Access to elite features and VIP support',
        HIGH_VALUE_FUNDING: 'Higher funding limits for trusted users',
      },
    };
  }

  @Get('reputation/leaderboard/top-creators')
  @ApiOperation({ summary: 'Get top creators leaderboard' })
  @ApiResponse({ status: 200, description: 'Top creators returned' })
  async getTopCreatorsLeaderboard(
    @Query('period') period: 'all-time' | 'monthly' | 'weekly' = 'all-time',
    @Query('limit') limit: number = 50,
    @Query('page') page: number = 1,
  ) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all-time':
      default:
        startDate = new Date(0);
        break;
    }

    const skip = (page - 1) * limit;

    // Get users with PROJECT_COMPLETION and MILESTONE_ACHIEVEMENT activities
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        reputationScore: true,
        profileData: true,
      },
      orderBy: {
        reputationScore: 'desc',
      },
      skip,
      take: limit,
    });

    const leaderboard = users.map((user, index) => ({
      rank: skip + index + 1,
      userId: user.id,
      reputationScore: user.reputationScore,
      profileData: user.profileData,
    }));

    const totalUsers = await this.prisma.user.count();

    return {
      period,
      category: 'top-creators',
      leaderboard,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    };
  }

  @Get('reputation/leaderboard/top-investors')
  @ApiOperation({ summary: 'Get top investors leaderboard' })
  @ApiResponse({ status: 200, description: 'Top investors returned' })
  async getTopInvestorsLeaderboard(
    @Query('period') period: 'all-time' | 'monthly' | 'weekly' = 'all-time',
    @Query('limit') limit: number = 50,
    @Query('page') page: number = 1,
  ) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all-time':
      default:
        startDate = new Date(0);
        break;
    }

    const skip = (page - 1) * limit;

    // Get users ranked by reputation score (investors gain reputation from successful transactions)
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        reputationScore: true,
        profileData: true,
      },
      where: {
        reputationScore: {
          gt: 0, // Only users with activity
        },
      },
      orderBy: {
        reputationScore: 'desc',
      },
      skip,
      take: limit,
    });

    const leaderboard = users.map((user, index) => ({
      rank: skip + index + 1,
      userId: user.id,
      reputationScore: user.reputationScore,
      profileData: user.profileData,
    }));

    const totalUsers = await this.prisma.user.count({
      where: {
        reputationScore: {
          gt: 0,
        },
      },
    });

    return {
      period,
      category: 'top-investors',
      leaderboard,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    };
  }

  @Get('reputation/leaderboard/user-rank')
  @ApiOperation({ summary: 'Get specific user rank in leaderboard' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User rank returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserRank(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { reputationScore: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Count how many users have a higher score
    const higherRankCount = await this.prisma.user.count({
      where: {
        reputationScore: {
          gt: user.reputationScore,
        },
      },
    });

    const rank = higherRankCount + 1;
    const totalUsers = await this.prisma.user.count();
    const percentile = ((totalUsers - rank) / totalUsers) * 100;

    return {
      userId: id,
      rank,
      reputationScore: user.reputationScore,
      totalUsers,
      percentile: Math.round(percentile * 100) / 100,
    };
  }
}
