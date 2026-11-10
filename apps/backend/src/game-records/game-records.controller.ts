import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { GameRecordPage } from '@pipou/shared';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { GameRecordQueryDto } from './dto/game-record-query.dto';
import { GameRecordsService } from './game-records.service';

/** Export des parties enregistrées (méta, apprentissage de l'IA hors ligne). */
@Controller('admin/game-records')
@UseGuards(JwtAuthGuard, AdminGuard)
export class GameRecordsController {
  constructor(private readonly records: GameRecordsService) {}

  @Get()
  list(@Query() query: GameRecordQueryDto): Promise<GameRecordPage> {
    return this.records.list({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      mode: query.mode,
      page: query.page ?? 1,
    });
  }

  /** NDJSON compressé : le navigateur ou `curl --compressed` le décompresse. */
  @Get(':id/trace')
  async trace(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const trace = await this.records.trace(id);
    if (!trace) throw new NotFoundException('Trace introuvable');
    res.set({
      'Content-Type': 'application/x-ndjson',
      'Content-Encoding': 'br',
      'Content-Disposition': `attachment; filename="game-${id}.ndjson"`,
    });
    return new StreamableFile(trace);
  }
}
