import { z } from 'zod';

export const ConsentActionSchema = z.enum(['grant', 'revoke']);

export const ConsentCategorySchema = z.enum([
  'cessation_data_processing',
  'support_circle_sharing',
  'health_data_processing',
]);

export type ConsentAction = z.infer<typeof ConsentActionSchema>;
export type ConsentCategory = z.infer<typeof ConsentCategorySchema>;
