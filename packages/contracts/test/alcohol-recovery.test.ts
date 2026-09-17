import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';
import type {
  AlcoholRecoveryContext,
  AlcoholRecoveryNextAction,
  AlcoholRecoveryReflection,
  AlcoholRecoverySession,
  AlcoholRecoverySessionState,
  WithdrawalSafetyDecision,
} from '../src/index';

const id = '550e8400-e29b-41d4-a716-446655440000';

interface RuntimeSchema {
  parse: (value: unknown) => unknown;
  safeParse: (value: unknown) => { success: boolean };
}

interface EnumSchema extends RuntimeSchema {
  options: readonly string[];
}

function schema(name: string): RuntimeSchema {
  const candidate = (contracts as Record<string, unknown>)[name] as RuntimeSchema | undefined;
  expect(candidate, `${name} must be exported`).toBeDefined();
  return candidate as RuntimeSchema;
}

function enumSchema(name: string): EnumSchema {
  return schema(name) as EnumSchema;
}

const safetyDecision = {
  engineId: 'alcohol_withdrawal_risk',
  ruleSetId: 'alcohol_withdrawal_risk_v1',
  ruleSetVersion: 1,
  disposition: 'behavior_change_support_allowed',
  reasonCodes: [],
  evaluatedEvidenceKeys: [],
  unknownCriticalEvidenceKeys: [],
  decidedAt: '2026-09-17T02:30:00.000Z',
} satisfies WithdrawalSafetyDecision;

const context = {
  recoverySessionId: id,
  triggeringUseEventId: id,
  userId: id,
  deviceId: id,
  startedAt: '2026-09-17T02:31:00.000Z',
  goalType: 'reduction',
  goalId: id,
  canMoveEnvironment: true,
  canUseAudio: false,
  canContactSupport: true,
  safetyDecision,
} satisfies AlcoholRecoveryContext;

const completeSession = {
  context,
  state: 'intervention_active',
  libraryContentVersion: 1,
  interventionId: 'alcohol-recovery-reset',
  interventionVersion: 1,
  currentStepIndex: 0,
  reflection: {
    planRelation: 'unplanned',
    triggerTags: ['social'],
    contextTags: ['dinner'],
    nextAction: 'continue_goal',
  },
  startedAt: '2026-09-17T02:31:00.000Z',
  updatedAt: '2026-09-17T02:32:00.000Z',
} satisfies AlcoholRecoverySession;

describe('alcohol recovery contracts', () => {
  it('exports the recovery schemas and inferred types through the root contract surface', () => {
    const inferredTypes: [
      AlcoholRecoveryNextAction,
      AlcoholRecoveryReflection,
      AlcoholRecoveryContext,
      AlcoholRecoverySessionState,
      AlcoholRecoverySession,
    ] = ['finish', {}, context, 'completed', completeSession];

    expect(inferredTypes).toHaveLength(5);
    for (const name of [
      'AlcoholRecoveryNextActionSchema',
      'AlcoholRecoveryReflectionSchema',
      'AlcoholRecoveryContextSchema',
      'AlcoholRecoverySessionStateSchema',
      'AlcoholRecoverySessionSchema',
    ]) {
      expect(schema(name)).toBeDefined();
    }
  });

  it('accepts an empty reflection and a complete strict recovery session', () => {
    expect(schema('AlcoholRecoveryReflectionSchema').parse({})).toEqual({});
    expect(schema('AlcoholRecoverySessionSchema').parse(completeSession)).toEqual(completeSession);
  });

  it('pins Alcohol goal and safety-decision identity', () => {
    const recoveryContext = schema('AlcoholRecoveryContextSchema');

    expect(recoveryContext.safeParse(context).success).toBe(true);
    expect(recoveryContext.safeParse({ ...context, goalType: 'smoke_free' }).success).toBe(false);
    expect(
      recoveryContext.safeParse({
        ...context,
        safetyDecision: { ...safetyDecision, disposition: 'urgent_medical_assessment' },
      }).success,
    ).toBe(true);
  });

  it('freezes the V1 state list and rejects unknown fields or invalid state values', () => {
    expect(enumSchema('AlcoholRecoverySessionStateSchema').options).toEqual([
      'started',
      'safety_routing',
      'reflecting',
      'intervention_selected',
      'intervention_active',
      'completed',
      'abandoned',
    ]);

    const session = schema('AlcoholRecoverySessionSchema');
    expect(session.safeParse({ ...completeSession, unexpected: true }).success).toBe(false);
    expect(session.safeParse({ ...completeSession, state: 'failed' }).success).toBe(false);
  });

  it('rejects Tobacco goal values', () => {
    expect(schema('AlcoholRecoveryContextSchema').safeParse({ ...context, goalType: 'quit_nicotine' }).success).toBe(false);
  });
});
