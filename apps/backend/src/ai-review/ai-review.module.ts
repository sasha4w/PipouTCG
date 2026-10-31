import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAnnotation } from './ai-annotation.entity';
import { AiDecision } from './ai-decision.entity';
import { AiReviewController } from './ai-review.controller';
import { AiReviewService } from './ai-review.service';
import { AI_DECISION_RECORDER } from './decision-recorder';

@Module({
  imports: [TypeOrmModule.forFeature([AiDecision, AiAnnotation])],
  controllers: [AiReviewController],
  providers: [
    AiReviewService,
    { provide: AI_DECISION_RECORDER, useExisting: AiReviewService },
  ],
  exports: [AI_DECISION_RECORDER],
})
export class AiReviewModule {}
