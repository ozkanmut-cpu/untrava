import { z } from 'zod';
import { UserIdSchema } from './ids';

export const ProductTypeSchema = z.enum(['cigarette', 'vape', 'heated_tobacco']);
export const GoalTypeSchema = z.enum(['smoke_free', 'tobacco_free', 'nicotine_free', 'reduction']);
export const QuitStrategySchema = z.enum([
  'quit_now',
  'future_date',
  'gradual_reduction',
  'learn_first',
]);

export const ProductBaselineSchema = z.object({
  product: ProductTypeSchema,
  dailyQuantity: z.number().nonnegative(),
});

export const QuitProfileSchema = z.object({
  userId: UserIdSchema,
  strategy: QuitStrategySchema,
  products: z.array(ProductBaselineSchema).min(1),
});

export const GoalSchema = z.object({
  goalId: z.uuid(),
  userId: UserIdSchema,
  type: GoalTypeSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
});

export type ProductType = z.infer<typeof ProductTypeSchema>;
export type GoalType = z.infer<typeof GoalTypeSchema>;
export type QuitStrategy = z.infer<typeof QuitStrategySchema>;
export type QuitProfile = z.infer<typeof QuitProfileSchema>;
export type Goal = z.infer<typeof GoalSchema>;
