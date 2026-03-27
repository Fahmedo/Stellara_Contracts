import { IsString, IsOptional, IsEnum, IsDate, IsObject, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExportType, ExportFormat } from '../entities/export-job.entity';

export class CreateExportDto {
  @ApiProperty({ enum: ExportType, description: 'Type of data to export' })
  @IsEnum(ExportType)
  exportType: ExportType;

  @ApiProperty({ enum: ExportFormat, description: 'Export format' })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({ description: 'Filters to apply to export' })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ type: Date, description: 'Schedule export for future date' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  scheduledFor?: Date;

  @ApiPropertyOptional({ description: 'Include sensitive data', default: false })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  includeSensitiveData?: boolean = false;
}

export class ExportFiltersDto {
  @ApiPropertyOptional({ description: 'Start date for data range' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for data range' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Specific record IDs to include' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recordIds?: string[];

  @ApiPropertyOptional({ description: 'Data status filter' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Include related entities', default: true })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  includeRelated?: boolean = true;
}

export class ExportStatusDto {
  @ApiProperty()
  @IsString()
  exportId: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  includeProgress?: boolean = true;
}

export class DownloadExportDto {
  @ApiProperty()
  @IsString()
  exportId: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  regenerateUrl?: boolean = false;
}

export class ScheduledExportDto extends CreateExportDto {
  @ApiProperty({ description: 'Cron expression for recurring exports' })
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiProperty({ description: 'Export name/label' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Enable automatic notifications', default: true })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  enableNotifications?: boolean = true;
}

export class ExportListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by export type' })
  @IsEnum(ExportType)
  @IsOptional()
  exportType?: ExportType;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by date range start' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by date range end' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
