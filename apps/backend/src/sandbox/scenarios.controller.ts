import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { SandboxScenarioSummary } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { ScenariosService } from './scenarios.service';

@Controller('sandbox/scenarios')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  list(): Promise<SandboxScenarioSummary[]> {
    return this.scenarios.list();
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.scenarios.remove(id);
  }
}
