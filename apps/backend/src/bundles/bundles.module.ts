import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bundle } from './bundle.entity';
import { BundleContent } from './bundle-content.entity';
import { UserBundle } from '../users/user-bundle.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { User } from '../users/user.entity';
import { BundlesService } from './bundles.service';
import { BundlesController } from './bundles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bundle,
      BundleContent,
      UserBundle,
      UserCard,
      UserBooster,
      User,
    ]),
  ],
  providers: [BundlesService],
  controllers: [BundlesController],
  exports: [BundlesService],
})
export class BundlesModule {}
