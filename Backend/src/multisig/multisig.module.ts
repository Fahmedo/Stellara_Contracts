import { Module } from '@nestjs/common';
import { MultisigService } from './multisig.service';
import { MultisigController } from './multisig.controller';

@Module({
  controllers: [MultisigController],
  providers: [MultisigService],
  exports: [MultisigService]
})
export class MultisigModule {}
