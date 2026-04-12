import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banner } from './banner.entity';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { UsersModule } from '../users/users.module';
import { BoostersModule } from '../boosters/boosters.module';
import { BundlesModule } from '../bundles/bundles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Banner]),
    UsersModule,
    BoostersModule,
    BundlesModule,
  ],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
