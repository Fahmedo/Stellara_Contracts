import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseInterceptors,
  UploadedFile,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModelRegistryService } from './model-registry.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';

@ApiTags('ML Model Registry')
@Controller('ml-models')
export class ModelRegistryController {
  constructor(private readonly modelRegistryService: ModelRegistryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('modelFile'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a new ML model' })
  @ApiResponse({ status: 201, description: 'Model successfully registered' })
  async create(
    @Body() createModelDto: CreateModelDto,
    @UploadedFile() modelFile: Express.Multer.File,
  ) {
    return this.modelRegistryService.create(createModelDto, modelFile.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Get all models' })
  @ApiResponse({ status: 200, description: 'List of all models' })
  findAll(
    @Query('name') name?: string,
    @Query('status') status?: string,
  ) {
    return this.modelRegistryService.findAll(name, status as any);
  }

  @Get('versions/:name')
  @ApiOperation({ summary: 'Get all versions of a model' })
  @ApiResponse({ status: 200, description: 'List of model versions' })
  getVersions(@Param('name') name: string) {
    return this.modelRegistryService.getModelVersions(name);
  }

  @Get('latest/:name')
  @ApiOperation({ summary: 'Get latest version of a model' })
  @ApiResponse({ status: 200, description: 'Latest model version' })
  getLatest(@Param('name') name: string) {
    return this.modelRegistryService.getLatestVersion(name);
  }

  @Get('production/:name')
  @ApiOperation({ summary: 'Get production version of a model' })
  @ApiResponse({ status: 200, description: 'Production model version' })
  getProduction(@Param('name') name: string) {
    return this.modelRegistryService.getProductionModel(name);
  }

  @Get(':name/:version')
  @ApiOperation({ summary: 'Get specific model version' })
  @ApiResponse({ status: 200, description: 'Model details' })
  findByNameAndVersion(
    @Param('name') name: string,
    @Param('version') version: string,
  ) {
    return this.modelRegistryService.findByNameAndVersion(name, version);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get model by ID' })
  @ApiResponse({ status: 200, description: 'Model details' })
  findOne(@Param('id') id: string) {
    return this.modelRegistryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update model metadata' })
  @ApiResponse({ status: 200, description: 'Model updated successfully' })
  update(@Param('id') id: string, @Body() updateModelDto: UpdateModelDto) {
    return this.modelRegistryService.update(id, updateModelDto);
  }

  @Post(':id/promote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Promote model to production' })
  @ApiResponse({ status: 200, description: 'Model promoted to production' })
  promoteToProduction(@Param('id') id: string) {
    return this.modelRegistryService.setProductionModel(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete model' })
  @ApiResponse({ status: 204, description: 'Model deleted successfully' })
  remove(@Param('id') id: string) {
    return this.modelRegistryService.remove(id);
  }
}
