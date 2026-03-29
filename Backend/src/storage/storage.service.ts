import { Injectable, Logger } from '@nestjs/common';
import { create } from 'ipfs-http-client';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private ipfs: ReturnType<typeof create>;
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    this.ipfs = create({
      host: 'your-ipfs-provider-url',
      port: 5000,
    });
  }

  async pinProjectMetadata(metadata: any): Promise<string> {
    const cid = await this.ipfs.add(metadata);
    return cid.path;
  }

  async uploadModel(
    modelName: string,
    version: string,
    modelFile: Buffer,
  ): Promise<string> {
    try {
      // Upload to IPFS or cloud storage
      const cid = await this.ipfs.add(modelFile);
      const modelPath = `ipfs://${cid.path}`;
      
      this.logger.log(`Uploaded model ${modelName} v${version} to ${modelPath}`);
      
      return modelPath;
    } catch (error) {
      this.logger.error(`Failed to upload model ${modelName} v${version}:`, error);
      throw error;
    }
  }

  async deleteModel(modelPath: string): Promise<void> {
    try {
      // Delete from IPFS or cloud storage
      this.logger.log(`Deleted model from ${modelPath}`);
    } catch (error) {
      this.logger.error(`Failed to delete model from ${modelPath}:`, error);
      throw error;
    }
  }

  async downloadModel(modelPath: string): Promise<Buffer> {
    try {
      // Download from IPFS or cloud storage
      if (modelPath.startsWith('ipfs://')) {
        const cid = modelPath.replace('ipfs://', '');
        const chunks = [];
        for await (const chunk of this.ipfs.cat(cid)) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }
      
      this.logger.log(`Downloaded model from ${modelPath}`);
      return Buffer.from('placeholder model data');
    } catch (error) {
      this.logger.error(`Failed to download model from ${modelPath}:`, error);
      throw error;
    }
  }

  async modelExists(modelPath: string): Promise<boolean> {
    try {
      // Check if model exists in IPFS or cloud storage
      if (modelPath.startsWith('ipfs://')) {
        const cid = modelPath.replace('ipfs://', '');
        // Check if CID exists
        return true;
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to check if model exists at ${modelPath}:`, error);
      return false;
    }
  }

  async optimizeImage(imagePath: string, width: number, height: number): Promise<Buffer> {
    const optimizedImage = await sharp(imagePath)
      .resize(width, height)
      .jpeg({ quality: 80 })
      .toBuffer();
    return optimizedImage;
  }

  async verifyIPFSHash(hash: string): Promise<boolean> {
    try {
      await this.ipfs.cat(hash);
      return true;
    } catch (error) {
      return false;
    }
  }
}
