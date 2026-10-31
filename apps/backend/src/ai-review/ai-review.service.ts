import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { gunzipSync, gzipSync } from 'node:zlib';
import { Repository } from 'typeorm';
import type {
  GameAction,
  AiReviewAnnotation,
  AiReviewAnnotationRequest,
  AiReviewCandidate,
  AiReviewDecision,
  AiReviewDecisionSummary,
  AiReviewGame,
} from '@pipou/shared';
import { parseAnnotation } from '../fights/ai/ai-feedback';
import {
  SUSPECT_REGRET,
  describeAction,
  heuristicRegret,
} from '../fights/ai/ai-review';
import type { DecisionRecord, DecisionSink } from '../fights/ai/decision-log';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { AiAnnotation } from './ai-annotation.entity';
import { AiDecision } from './ai-decision.entity';
import type { DecisionRecorder } from './decision-recorder';

const MAX_GAMES = 50;
const MAX_TEXT = 255;

@Injectable()
export class AiReviewService implements DecisionRecorder {
  private readonly logger = new Logger(AiReviewService.name);

  constructor(
    @InjectRepository(AiDecision)
    private readonly decisions: Repository<AiDecision>,
    @InjectRepository(AiAnnotation)
    private readonly annotations: Repository<AiAnnotation>,
  ) {}

  sinkFor(userId: number, isAdmin: boolean): DecisionSink | null {
    if (!isAdmin) return null;
    return (record) => {
      // Fire and forget : le journal ne doit jamais ralentir ni bloquer l'IA
      this.save(userId, record).catch((err: unknown) =>
        this.logger.warn(
          `Décision ${record.id} non enregistrée — ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    };
  }

  private async save(userId: number, record: DecisionRecord): Promise<void> {
    await this.decisions.insert({
      id: record.id,
      // `${run}:${matchId}:${siège}:${n}` : la partie, c'est tout sauf siège et n°
      gameId: record.id.split(':').slice(0, 2).join(':'),
      userId,
      turn: record.turn,
      phase: record.phase,
      seat: record.seat,
      archetype: record.archetype,
      level: record.level,
      source: record.source,
      chosen: record.chosen,
      chosenText: describeAction(record.chosen, record.state).slice(
        0,
        MAX_TEXT,
      ),
      candidates: record.candidates,
      baseline: record.baseline ?? null,
      regret: heuristicRegret(record),
      simulationCrashes: record.simulationCrashes,
      stateGz: gzipSync(JSON.stringify(record.state)),
    });
  }

  async listGames(): Promise<AiReviewGame[]> {
    const rows: {
      gameId: string;
      createdAt: Date;
      archetype: AiReviewGame['archetype'];
      level: number;
      decisions: string;
      suspects: string;
      annotated: string;
    }[] = await this.decisions.query(
      `SELECT d.game_id AS gameId, MIN(d.created_at) AS createdAt,
              MAX(d.archetype) AS archetype, MAX(d.level) AS level,
              COUNT(*) AS decisions, SUM(d.regret >= ?) AS suspects,
              (SELECT COUNT(DISTINCT a.decision_id) FROM ai_annotation a
                 JOIN ai_decision x ON x.id = a.decision_id
                WHERE x.game_id = d.game_id) AS annotated
         FROM ai_decision d
        GROUP BY d.game_id
        ORDER BY createdAt DESC
        LIMIT ${MAX_GAMES}`,
      [SUSPECT_REGRET],
    );
    return rows.map((r) => ({
      gameId: r.gameId,
      createdAt: new Date(r.createdAt).toISOString(),
      archetype: r.archetype,
      level: Number(r.level),
      decisions: Number(r.decisions),
      suspects: Number(r.suspects),
      annotated: Number(r.annotated),
    }));
  }

  async listDecisions(gameId: string): Promise<AiReviewDecisionSummary[]> {
    const rows = await this.decisions.find({
      where: { gameId },
      order: { createdAt: 'ASC', id: 'ASC' },
      select: {
        id: true,
        turn: true,
        phase: true,
        source: true,
        chosenText: true,
        regret: true,
      },
    });
    const annotated = new Set(
      (
        await this.annotations
          .createQueryBuilder('a')
          .select('DISTINCT a.decision_id', 'id')
          .innerJoin(AiDecision, 'd', 'd.id = a.decision_id')
          .where('d.game_id = :gameId', { gameId })
          .getRawMany<{ id: string }>()
      ).map((r) => r.id),
    );
    return rows.map((d) => ({
      id: d.id,
      turn: d.turn,
      phase: d.phase,
      source: d.source,
      chosenText: d.chosenText,
      regret: d.regret,
      annotated: annotated.has(d.id),
    }));
  }

  async getDecision(id: string): Promise<AiReviewDecision> {
    const d = await this.decisions.findOneBy({ id });
    if (!d) throw new NotFoundException('Décision introuvable');
    const state = JSON.parse(
      gunzipSync(d.stateGz).toString('utf8'),
    ) as GameState;
    const chosenJson = JSON.stringify(d.chosen);
    const candidates: AiReviewCandidate[] = d.candidates
      .map((c, index) => ({
        index,
        action: c.action,
        text: describeAction(c.action, state),
        score: c.score,
        chosen: JSON.stringify(c.action) === chosenJson,
      }))
      .sort((a, b) => b.score - a.score);
    const notes = await this.annotations.find({
      where: { decisionId: id },
      order: { createdAt: 'ASC' },
    });
    return {
      id: d.id,
      gameId: d.gameId,
      seat: d.seat,
      archetype: d.archetype,
      level: d.level,
      turn: d.turn,
      phase: d.phase,
      source: d.source,
      chosenText: d.chosenText,
      regret: d.regret,
      annotated: notes.length > 0,
      baseline: d.baseline,
      candidates,
      simulationCrashes: d.simulationCrashes.map((c) => ({
        text: describeAction(c.action, state),
        message: c.message,
      })),
      annotations: notes.map(toAnnotationView),
    };
  }

  async annotate(
    userId: number,
    decisionId: string,
    dto: AiReviewAnnotationRequest,
  ): Promise<AiReviewAnnotation> {
    const d = await this.decisions.findOneBy({ id: decisionId });
    if (!d) throw new NotFoundException('Décision introuvable');
    let preferred: GameAction | null = null;
    if (dto.preferredIndex !== undefined) {
      preferred = d.candidates[dto.preferredIndex]?.action ?? null;
      if (!preferred)
        throw new BadRequestException('Candidat préféré inexistant');
    }
    try {
      parseAnnotation({
        decisionId,
        ...dto,
        preferred: preferred ?? undefined,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Annotation invalide',
      );
    }
    const saved = await this.annotations.save(
      this.annotations.create({
        decisionId,
        userId,
        verdict: dto.verdict,
        preferred,
        category: dto.category ?? null,
        comment: dto.comment?.trim() || null,
        outcome: dto.outcome ?? null,
      }),
    );
    return toAnnotationView(saved);
  }

  /** Toutes les annotations avec le contexte de leur décision, pour analyse hors ligne. */
  async exportAnnotations(): Promise<
    {
      decision: Omit<AiReviewDecision, 'annotations'>;
      annotations: AiReviewAnnotation[];
    }[]
  > {
    const ids = (
      await this.annotations
        .createQueryBuilder('a')
        .select('DISTINCT a.decision_id', 'id')
        .getRawMany<{ id: string }>()
    ).map((r) => r.id);
    const out: {
      decision: Omit<AiReviewDecision, 'annotations'>;
      annotations: AiReviewAnnotation[];
    }[] = [];
    for (const id of ids) {
      const { annotations, ...decision } = await this.getDecision(id);
      out.push({ decision, annotations });
    }
    return out;
  }
}

function toAnnotationView(a: AiAnnotation): AiReviewAnnotation {
  return {
    id: a.id,
    decisionId: a.decisionId,
    verdict: a.verdict,
    preferred: a.preferred,
    category: a.category,
    comment: a.comment,
    outcome: a.outcome,
    createdAt: a.createdAt.toISOString(),
  };
}
