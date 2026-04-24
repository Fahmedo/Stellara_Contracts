import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  Headers,
  Get,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StorageService, UploadResult } from './storage.service';

@ApiTags('Storage')
@Controller('storage')
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to IPFS with validation' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Upload result with IPFS URL' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-user-id') userId: string,
  ): Promise<UploadResult> {
    return this.storageService.uploadToIpfs(file, userId ?? 'anonymous');
  }

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Upload result' })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-user-id') userId: string,
  ): Promise<UploadResult> {
    return this.storageService.uploadImage(file, userId ?? 'anonymous');
  }

  @Post('projects/metadata')
  @ApiOperation({ summary: 'Pin project metadata to IPFS' })
  @ApiResponse({ status: 201, description: 'CID returned' })
  async pinProjectMetadata(@Body() metadata: any): Promise<string> {
    return this.storageService.pinProjectMetadata(metadata);
  }

  @Post('projects/verify-hash')
  @ApiOperation({ summary: 'Verify an IPFS hash is valid' })
  @ApiResponse({ status: 200, description: 'Hash verification result' })
  async verifyIPFSHash(@Body('hash') hash: string): Promise<boolean> {
    return this.storageService.verifyIPFSHash(hash);
  }

  @Get('upload/stats')
  @ApiOperation({ summary: 'Get upload stats for a user' })
  @ApiResponse({ status: 200, description: 'Upload stats' })
  async getUploadStats(@Query('userId') userId: string): Promise<Record<string, any>> {
    return this.storageService.getUploadStats(userId ?? 'anonymous');
  }

  @Get('allowed-types')
  @ApiOperation({ summary: 'List allowed upload MIME types' })
  @ApiResponse({ status: 200, description: 'List of allowed MIME types' })
  getAllowedTypes(): string[] {
    return this.storageService.getAllowedTypes();
  }
}
