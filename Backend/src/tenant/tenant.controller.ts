import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { TenantQuotaService } from '../quota/quota.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly quotaService: TenantQuotaService,
  ) {}

  /**
   * POST /tenants
   * Provision a new tenant. SUPER_ADMIN only.
   */
  @Post()
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  provision(@Body() dto: CreateTenantDto, @CurrentUser() user: any) {
    return this.tenantService.provision(dto, user?.id);
  }

  /**
   * GET /tenants
   * List all active tenants. SUPER_ADMIN only.
   */
  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.tenantService.findAll();
  }

  /**
   * GET /tenants/:id
   * Get a single tenant. SUPER_ADMIN or TENANT_ADMIN.
   */
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  /**
   * GET /tenants/:id/settings
   * Get tenant settings. SUPER_ADMIN or TENANT_ADMIN.
   */
  @Get(':id/settings')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  getSettings(@Param('id') id: string) {
    return this.tenantService.getSettings(id);
  }

  /**
   * PATCH /tenants/:id/settings
   * Update tenant settings. SUPER_ADMIN or TENANT_ADMIN.
   */
  @Patch(':id/settings')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() user: any,
  ) {
    return this.tenantService.updateSettings(id, dto, user?.id);
  }

  /**
   * GET /tenants/:id/audit-logs
   * Fetch audit trail for a tenant. SUPER_ADMIN only.
   */
  @Get(':id/audit-logs')
  @Roles(Role.SUPER_ADMIN)
  getAuditLogs(@Param('id') id: string) {
    return this.tenantService.getAuditLogs(id);
  }

  /**
   * GET /tenants/:id/usage
   * Tenant usage dashboard (API quota usage, limits, and usage counters).
   */
  @Get(':id/usage')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  getUsage(@Param('id') id: string) {
    return this.quotaService.getTenantUsage(id);
  }
}
