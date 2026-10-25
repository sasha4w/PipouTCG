import { Module } from '@nestjs/common';
import { ForgeController } from './forge.controller';
import { ForgeService } from './forge.service';

@Module({
  controllers: [ForgeController],
  providers: [ForgeService],
})
export class ForgeModule {}
