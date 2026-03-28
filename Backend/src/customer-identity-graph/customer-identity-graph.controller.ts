import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CustomerIdentityGraphService } from './customer-identity-graph.service';
import { IdentityEvidenceDto } from './dto/identity-graph.dto';

@ApiTags('Customer Identity Graph')
@Controller('identity-graph')
export class CustomerIdentityGraphController {
  constructor(private readonly identityGraphService: CustomerIdentityGraphService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest identity evidence and update the identity graph in real time' })
  @ApiResponse({ status: 201, description: 'Identity evidence ingested successfully' })
  async ingest(@Body() evidence: IdentityEvidenceDto) {
    return this.identityGraphService.ingestIdentityEvidence(evidence);
  }

  @Get('resolve/:entityType/:entityValue')
  @ApiOperation({ summary: 'Resolve a graph entity and its related identity links' })
  @ApiParam({ name: 'entityType', enum: ['user', 'device', 'email', 'phone', 'ip', 'wallet', 'ssnHash', 'fingerprint', 'household', 'organization'] })
  @ApiParam({ name: 'entityValue', description: 'Entity identifier value' })
  async resolve(
    @Param('entityType') entityType: string,
    @Param('entityValue') entityValue: string,
    @Query('depth') depth = '2',
  ) {
    return this.identityGraphService.getLinkGraph(entityType, entityValue, parseInt(depth, 10));
  }

  @Get('export/:userId')
  @ApiOperation({ summary: 'Export identity graph data for GDPR or investigation purposes' })
  @ApiParam({ name: 'userId', description: 'Platform user ID' })
  async export(@Param('userId') userId: string) {
    return this.identityGraphService.exportUserGraphData(userId);
  }

  @Delete('erase/:userId')
  @ApiOperation({ summary: 'Erase graph data for a user in a GDPR-compliant way' })
  @ApiParam({ name: 'userId', description: 'Platform user ID to erase from the graph' })
  async erase(@Param('userId') userId: string) {
    return this.identityGraphService.eraseUserGraphData(userId);
  }

  @Get('synthetic-risk/:userId')
  @ApiOperation({ summary: 'Assess synthetic identity risk for a user' })
  @ApiParam({ name: 'userId', description: 'Platform user ID' })
  async syntheticRisk(@Param('userId') userId: string) {
    return this.identityGraphService.detectSyntheticIdentityRisk(userId);
  }
}
