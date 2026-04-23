import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CompetitionService } from '../services/competition.service';
import { CreateCompetitionDto } from '../dto/create-competition.dto';
import { JoinCompetitionDto } from '../dto/join-competition.dto';
import { RecordTradeDto } from '../dto/record-trade.dto';

@Controller('api/competitions')
export class ApiController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listCompetitions() {
    return this.competitionService.listCompetitions();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCompetition(@Body() createCompetitionDto: CreateCompetitionDto) {
    return this.competitionService.createCompetition(createCompetitionDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getCompetition(@Param('id') id: string) {
    return this.competitionService.getCompetition(id);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.CREATED)
  async joinCompetition(
    @Param('id') id: string,
    @Body() joinCompetitionDto: JoinCompetitionDto,
  ) {
    return this.competitionService.joinCompetition({
      ...joinCompetitionDto,
      competitionId: id,
    });
  }

  @Post(':id/trades')
  @HttpCode(HttpStatus.CREATED)
  async recordTrade(
    @Param('id') id: string,
    @Body() recordTradeDto: RecordTradeDto,
  ) {
    return this.competitionService.recordTrade({
      ...recordTradeDto,
      competitionId: id,
    });
  }

  @Get(':id/leaderboard')
  @HttpCode(HttpStatus.OK)
  async getLeaderboard(@Param('id') id: string) {
    return this.competitionService.getLeaderboard(id);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  async finishCompetition(@Param('id') id: string) {
    return this.competitionService.finishCompetition(id);
  }
}
