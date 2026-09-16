import { z } from 'zod';
import { UserIdSchema } from '../ids';

export const ModuleIdSchema = z.string().min(1);

export const CoreGoalRecordSchema = z.object({
  goalId: z.uuid(),
  userId: UserIdSchema,
  moduleId: ModuleIdSchema,
  goalTypeKey: z.string().min(1),
  goalSchemaVersion: z.number().int().positive(),
  config: z.unknown(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
});

export type ModuleId = z.infer<typeof ModuleIdSchema>;
export type CoreGoalRecord = z.infer<typeof CoreGoalRecordSchema>;
