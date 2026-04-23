import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompetitionService } from '../services/competition.service';
import { LeaderboardService } from '../services/leaderboard.service';
import { CreateCompetitionDto } from '../dto/create-competition.dto';
import { JoinCompetitionDto } from '../dto/join-competition.dto';
import { RecordTradeDto } from '../dto/record-trade.dto';
import { CompetitionStatus, CompetitionType } from '../enums/competition-type.enum';

@Controller('competitions')
export class CompetitionController {
  constructor(
    private readonly competitionService: CompetitionService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCompetition(@Body() createCompetitionDto: CreateCompetitionDto) {
    return this.competitionService.createCompetition(createCompetitionDto);
  }

  @Get()
  async listCompetitions(
    @Query('status') status?: CompetitionStatus,
    @Query('type') type?: CompetitionType,
  ) {
    return this.competitionService.listCompetitions(status, type);
  }

  @Get(':id')
  async getCompetition(@Param('id') id: string) {
    return this.competitionService.getCompetition(id);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.CREATED)
  async joinCompetition(@Param('id') competitionId: string, @Body() joinCompetitionDto: JoinCompetitionDto) {
    return this.competitionService.joinCompetition({
      ...joinCompetitionDto,
      competitionId,
    });
  }

  @Post(':id/trades')
  @HttpCode(HttpStatus.CREATED)
  async recordTrade(@Param('id') competitionId: string, @Body() recordTradeDto: RecordTradeDto) {
    return this.competitionService.recordTrade({
      ...recordTradeDto,
      competitionId,
    });
  }

  @Get(':id/leaderboard')
  async getLeaderboard(
    @Param('id') competitionId: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.leaderboardService.getLeaderboardWithMetrics(competitionId, userId);
  }

  @Get(':id/leaderboard/realtime')
  async getRealTimeLeaderboard(
    @Param('id') competitionId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.leaderboardService.getRealTimeLeaderboard(competitionId, limitNum);
  }

  @Get(':id/leaderboard/stats')
  async getLeaderboardStats(@Param('id') competitionId: string) {
    return this.leaderboardService.getLeaderboardStats(competitionId);
  }

  @Get(':id/leaderboard/top')
  async getTopPerformers(
    @Param('id') competitionId: string,
    @Query('metric') metric: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.leaderboardService.getTopPerformers(competitionId, metric, limitNum);
  }

  @Get(':id/anti-cheat')
  async getAntiCheatFlags(
    @Param('id') competitionId: string,
    @Query('status') status?: string,
  ) {
    return this.competitionService.getAntiCheatFlags(competitionId, status);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  async finishCompetition(@Param('id') competitionId: string) {
    return this.competitionService.finishCompetition(competitionId);
  }

  @Get('user/:userId')
  async getUserCompetitions(
    @Param('userId') userId: string,
    @Query('status') status?: CompetitionStatus,
  ) {
    return this.competitionService.getUserCompetitions(userId, status);
  }

  @Get('user/:userId/achievements')
  async getUserAchievements(@Param('userId') userId: string) {
    return this.competitionService.getUserAchievements(userId);
  }
}
