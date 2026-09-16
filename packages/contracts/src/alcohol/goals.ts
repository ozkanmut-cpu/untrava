import { z } from 'zod';

export const AlcoholGoalTypeSchema = z.enum([
  'observe_only',
  'abstinence',
  'reduction',
  'alcohol_free_days',
  'usage_limit',
]);

export type AlcoholGoalType = z.infer<typeof AlcoholGoalTypeSchema>;
