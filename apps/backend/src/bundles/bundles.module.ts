import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bundle } from './bundle.entity';
import { BundleContent } from './bundle-content.entity';
import { BundlesService } from './bundles.service';
import { BundlesController } from './bundles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bundle, BundleContent])],
  providers: [BundlesService],
  controllers: [BundlesController],
  exports: [BundlesService],
})
export class BundlesModule {}
