import { IsIn } from 'class-validator';
import { Archetype } from '@pipou/shared';
import type { ClaimStarterBody } from '@pipou/shared';

export class ClaimStarterDto implements ClaimStarterBody {
  @IsIn(Object.values(Archetype))
  archetype!: Archetype;
}
