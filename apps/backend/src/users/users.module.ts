import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

import { User } from './user.entity';
import { UserCard } from './user-card.entity';
import { UserBooster } from './user-booster.entity';
import { UserBundle } from './user-bundle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserCard, UserBooster, UserBundle]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
