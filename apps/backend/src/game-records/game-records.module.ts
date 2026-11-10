import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRecord } from './game-record.entity';
import { GameRecordsController } from './game-records.controller';
import { GameRecordsService } from './game-records.service';
import { GameRecorder, recorderOptions } from './game-recorder';
import { GAME_RECORDER } from './game-recorder.port';

@Module({
  imports: [TypeOrmModule.forFeature([GameRecord])],
  controllers: [GameRecordsController],
  providers: [
    GameRecordsService,
    {
      provide: GAME_RECORDER,
      inject: [GameRecordsService],
      useFactory: (store: GameRecordsService) =>
        new GameRecorder(store, recorderOptions(process.env)),
    },
  ],
  exports: [GAME_RECORDER],
})
export class GameRecordsModule {}
