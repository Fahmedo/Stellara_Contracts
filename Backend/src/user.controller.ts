import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { sanitizeUnknown } from './common/utils/sanitize.util';
import { CreateUserDto } from './user/dto/create-user.dto';
import { UpdateUserDto } from './user/dto/update-user.dto';
import { UserIdParamDto } from './user/dto/user-id-param.dto';
import { UserQueryDto } from './user/dto/user-query.dto';

@Controller('api/user')
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listUsers(@Query() query: UserQueryDto) {
    const where = {
      ...(query.walletAddress ? { walletAddress: query.walletAddress } : {}),
      ...(query.email ? { email: query.email } : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.toUserResponse(user)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  @Get(':id')
  async getUser(@Param() { id }: UserIdParamDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    const profileData = this.toPrismaJson(createUserDto.profileData);
    const user = await this.prisma.user.create({
      data: {
        walletAddress: createUserDto.walletAddress,
        email: createUserDto.email,
        ...(profileData !== undefined ? { profileData } : {}),
      },
    });

    return this.toUserResponse(user);
  }

  @Patch(':id')
  async updateUser(
    @Param() { id }: UserIdParamDto,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const existingUser = await this.prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const profileData = this.toPrismaJson(updateUserDto.profileData);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(updateUserDto.walletAddress ? { walletAddress: updateUserDto.walletAddress } : {}),
        ...(updateUserDto.email ? { email: updateUserDto.email } : {}),
        ...(profileData !== undefined ? { profileData } : {}),
      },
    });

    return this.toUserResponse(user);
  }

  private toUserResponse(user: {
    id: string;
    walletAddress: string;
    email: string | null;
    profileData: unknown;
    reputationScore: number;
    trustScore: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      profileData: user.profileData,
      reputationScore: user.reputationScore,
      trustScore: user.trustScore,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }

    return sanitizeUnknown(value) as Prisma.InputJsonValue;
  }
}
