import { PartialType } from '@nestjs/mapped-types';
import { CreateCardDto } from './create-card.dto';
import type { UpdateCardRequest } from '@pipou/shared';

export class UpdateCardDto
  extends PartialType(CreateCardDto)
  implements UpdateCardRequest {}
