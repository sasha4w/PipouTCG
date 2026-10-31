import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AiReviewAnnotation,
  AiReviewDecision,
  AiReviewDecisionSummary,
  AiReviewGame,
} from '@pipou/shared';
import { AdminGuard } from '../auth/admin.guard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AiReviewService } from './ai-review.service';
import { AiAnnotationDto } from './dto/ai-annotation.dto';

@Controller('admin/ai-review')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AiReviewController {
  constructor(private readonly review: AiReviewService) {}

  @Get('games')
  games(): Promise<AiReviewGame[]> {
    return this.review.listGames();
  }

  @Get('games/:gameId/decisions')
  decisions(
    @Param('gameId') gameId: string,
  ): Promise<AiReviewDecisionSummary[]> {
    return this.review.listDecisions(gameId);
  }

  @Get('decisions/:id')
  decision(@Param('id') id: string): Promise<AiReviewDecision> {
    return this.review.getDecision(id);
  }

  @Post('decisions/:id/annotations')
  annotate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AiAnnotationDto,
  ): Promise<AiReviewAnnotation> {
    return this.review.annotate(req.user.userId, id, dto);
  }

  /** Annotations avec le contexte de leur décision, pour analyse hors ligne. */
  @Get('export')
  export() {
    return this.review.exportAnnotations();
  }
}
