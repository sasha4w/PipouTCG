import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { ForgeService } from './forge.service';
import { ForgeDto } from './dto/forge.dto';
import { DestroyDto } from './dto/destroy.dto';

@Controller('forge')
@UseGuards(JwtAuthGuard)
export class ForgeController {
  constructor(private readonly forgeService: ForgeService) {}

  @Get('usable')
  usable(@Req() req: AuthenticatedRequest) {
    return this.forgeService.listUsable(req.user.userId);
  }

  @Post()
  forge(@Req() req: AuthenticatedRequest, @Body() dto: ForgeDto) {
    return this.forgeService.forge(req.user.userId, dto);
  }

  @Post('destroy')
  destroy(@Req() req: AuthenticatedRequest, @Body() dto: DestroyDto) {
    return this.forgeService.destroy(req.user.userId, dto);
  }
}
