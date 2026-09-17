import { z } from 'zod';
import { DeviceIdSchema, EventIdSchema, UserIdSchema } from '../ids';
import { AlcoholGoalTypeSchema } from './goals';
import { WithdrawalSafetyDecisionSchema } from './safety';

export const AlcoholPlanRelationSchema = z.enum(['planned', 'unplanned', 'unknown']);

export const AlcoholInterventionModeSchema = z.enum(['rescue', 'recovery']);

export const AlcoholRecoveryNextActionSchema = z.enum([
  'continue_goal',
  'open_rescue',
  'offer_support',
  'review_plan',
  'finish',
]);

export const AlcoholRecoveryReflectionSchema = z
  .object({
    planRelation: AlcoholPlanRelationSchema.optional(),
    triggerTags: z.array(z.string().min(1)).optional(),
    contextTags: z.array(z.string().min(1)).optional(),
    nextAction: AlcoholRecoveryNextActionSchema.optional(),
  })
  .strict();

export const AlcoholRecoveryContextSchema = z
  .object({
    recoverySessionId: z.uuid(),
    triggeringUseEventId: EventIdSchema,
    userId: UserIdSchema,
    deviceId: DeviceIdSchema,
    startedAt: z.iso.datetime(),
    goalType: AlcoholGoalTypeSchema,
    goalId: z.uuid().optional(),
    canMoveEnvironment: z.boolean().optional(),
    canUseAudio: z.boolean().optional(),
    canContactSupport: z.boolean().optional(),
    safetyDecision: WithdrawalSafetyDecisionSchema,
  })
  .strict();

export const AlcoholRecoverySessionStateSchema = z.enum([
  'started',
  'safety_routing',
  'reflecting',
  'intervention_selected',
  'intervention_active',
  'completed',
  'abandoned',
]);

export const AlcoholRecoverySessionSchema = z
  .object({
    context: AlcoholRecoveryContextSchema,
    state: AlcoholRecoverySessionStateSchema,
    libraryContentVersion: z.number().int().positive(),
    interventionId: z.string().min(1).nullable(),
    interventionVersion: z.number().int().positive().nullable(),
    currentStepIndex: z.number().int().nonnegative(),
    reflection: AlcoholRecoveryReflectionSchema.optional(),
    startedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((session, ctx) => {
    const hasId = session.interventionId !== null;
    const hasVersion = session.interventionVersion !== null;
    const hasIntervention = hasId || hasVersion;
    const safetyRouting = session.context.safetyDecision.disposition === 'emergency_response' ||
      session.context.safetyDecision.disposition === 'urgent_medical_assessment';
    const beforeSelection = session.state === 'started' || session.state === 'reflecting';

    if (hasId !== hasVersion) {
      ctx.addIssue({ code: 'custom', message: 'alcohol_recovery_intervention_provenance_incomplete', path: ['interventionId'] });
    }
    if (
      (safetyRouting && !['safety_routing', 'completed', 'abandoned'].includes(session.state)) ||
      (!safetyRouting && session.state === 'safety_routing')
    ) {
      ctx.addIssue({ code: 'custom', message: 'alcohol_recovery_safety_state_mismatch', path: ['state'] });
    }
    if ((safetyRouting || beforeSelection) && hasIntervention) {
      ctx.addIssue({ code: 'custom', message: 'alcohol_recovery_intervention_not_allowed', path: ['interventionId'] });
    }
    if (
      !safetyRouting &&
      ['intervention_selected', 'intervention_active', 'completed'].includes(session.state) &&
      (!hasId || !hasVersion)
    ) {
      ctx.addIssue({ code: 'custom', message: 'alcohol_recovery_intervention_required', path: ['interventionId'] });
    }
    if ((safetyRouting || session.state === 'started') && session.reflection !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'alcohol_recovery_reflection_not_allowed', path: ['reflection'] });
    }
    if (
      (safetyRouting || !hasIntervention || session.state === 'intervention_selected') &&
      session.currentStepIndex !== 0
    ) {
      ctx.addIssue({ code: 'custom', message: 'alcohol_recovery_step_not_allowed', path: ['currentStepIndex'] });
    }
  });

export type AlcoholRecoveryNextAction = z.infer<typeof AlcoholRecoveryNextActionSchema>;
export type AlcoholInterventionMode = z.infer<typeof AlcoholInterventionModeSchema>;
export type AlcoholRecoveryReflection = z.infer<typeof AlcoholRecoveryReflectionSchema>;
export type AlcoholRecoveryContext = z.infer<typeof AlcoholRecoveryContextSchema>;
export type AlcoholRecoverySessionState = z.infer<typeof AlcoholRecoverySessionStateSchema>;
export type AlcoholRecoverySession = z.infer<typeof AlcoholRecoverySessionSchema>;
