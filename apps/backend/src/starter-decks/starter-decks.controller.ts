import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { StarterDecksService } from './starter-decks.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { ClaimStarterDto } from './dto/claim-starter.dto';
import type { AuthenticatedRequest } from '../auth/auth-user';

@Controller('starter-decks')
export class StarterDecksController {
  constructor(private readonly service: StarterDecksService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getStatus(@Req() req: AuthenticatedRequest) {
    return this.service.getStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('claim')
  claim(@Req() req: AuthenticatedRequest, @Body() dto: ClaimStarterDto) {
    return this.service.claim(req.user.userId, dto.archetype);
  }
}
