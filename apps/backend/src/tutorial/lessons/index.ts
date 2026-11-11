import type { TutorialLessonId } from '@pipou/shared';
import type { Lesson } from '../lesson.types';
import { combat } from './combat';
import { control } from './control';
import { drakon } from './drakon';
import { firstTurn } from './first-turn';
import { guard } from './guard';
import { pipou } from './pipou';
import { pixelman } from './pixelman';
import { statuses } from './statuses';
import { supports } from './supports';

export const LESSONS: Partial<Record<TutorialLessonId, Lesson>> = {
  'first-turn': firstTurn,
  combat,
  guard,
  supports,
  control,
  pipou,
  drakon,
  pixelman,
  statuses,
};
