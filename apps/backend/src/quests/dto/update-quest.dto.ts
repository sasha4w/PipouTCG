import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestDto } from './create-quest.dto';
import type { UpdateQuestRequest } from '@pipou/shared';

export class UpdateQuestDto
  extends PartialType(CreateQuestDto)
  implements UpdateQuestRequest {}
