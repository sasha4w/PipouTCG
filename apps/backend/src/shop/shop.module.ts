import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booster } from '../boosters/booster.entity';
import { Bundle } from '../bundles/bundle.entity';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booster, Bundle])],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
