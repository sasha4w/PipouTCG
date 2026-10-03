import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SandboxScenarioSummary } from '@pipou/shared';
import { SandboxScenario } from './sandbox-scenario.entity';
import type { SerializedGame } from './scenario-serializer';

@Injectable()
export class ScenariosService {
  constructor(
    @InjectRepository(SandboxScenario)
    private repo: Repository<SandboxScenario>,
  ) {}

  async list(): Promise<SandboxScenarioSummary[]> {
    const rows = await this.repo.find({
      relations: { createdBy: true },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdBy: r.createdBy.username,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async create(input: {
    name: string;
    description: string | null;
    state: SerializedGame;
    createdById: number;
  }): Promise<number> {
    const row = await this.repo.save(this.repo.create(input));
    return row.id;
  }

  async findState(id: number): Promise<SerializedGame | null> {
    const row = await this.repo.findOneBy({ id });
    return row?.state ?? null;
  }

  async remove(id: number): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Scénario introuvable');
  }
}
