import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { MultisigService } from './multisig.service';
import { DetectMultisigDto } from './dto/detect-multisig.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { AddSignatureDto } from './dto/add-signature.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('multisig')
@UseGuards(AuthGuard('jwt'))
export class MultisigController {
  constructor(private readonly multisigService: MultisigService) {}

  @Post('detect')
  async detect(@Body() dto: DetectMultisigDto) {
    return this.multisigService.detectMultiSigAccount(dto.accountId);
  }

  @Post('proposals')
  async createProposal(@CurrentUser() user: any, @Body() dto: CreateProposalDto) {
    return this.multisigService.createProposal(user.id, dto);
  }

  @Post('proposals/:id/signatures')
  async addSignature(@Param('id') id: string, @Body() dto: AddSignatureDto) {
    return this.multisigService.addSignature(id, dto);
  }

  @Get('proposals/:id')
  async getProposal(@Param('id') id: string) {
    return this.multisigService.getProposal(id);
  }
}
