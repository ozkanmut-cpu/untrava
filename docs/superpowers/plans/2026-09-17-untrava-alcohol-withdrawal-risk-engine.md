# UNTRAVA Alcohol Withdrawal Risk Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement roadmap item #33 as an offline, deterministic, versioned Alcohol withdrawal-risk gate that produces auditable routing decisions without diagnosis, taper instructions, medication dosing, AI authority, doctor integration, breathalyzer dependency, or Alcohol logic inside Core/Generic Rescue.

**Architecture:** Alcohol-owned Zod contracts define tri-state evidence, change intent, versioned policy identity, routing dispositions, reason codes and decision traces. The mobile Alcohol module owns a sealed V1 policy bundle plus a pure evaluator with hard emergency/urgent precedence, intent-sensitive fail-closed behavior and deterministic reason ordering. Generic Core/Rescue and Tobacco remain unaware of Alcohol withdrawal semantics, enforced by source-boundary tests.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 3, pnpm 10.17.1, existing UNTRAVA contracts/mobile workspace.

**Spec:** `docs/superpowers/specs/2026-09-16-untrava-alcohol-withdrawal-risk-engine-design.md`

## Global Constraints

- Work only on branch `rescue-interventions`; do not merge or modify `main` without explicit user approval.
- Do not touch any VDS or production field-maintenance infrastructure.
- Core must not import Alcohol safety schemas or literals.
- Generic Rescue must not contain Alcohol withdrawal rules, thresholds or routing logic.
- Tobacco must not import Alcohol safety schemas.
- The engine is deterministic and offline; no network, generative AI, doctor communication, breathalyzer or BAC dependency.
- The engine never diagnoses AUD/withdrawal, declares home detox safe, generates taper schedules, or starts/stops/changes/calculates medication doses.
- `observe` may continue factual logging when historical withdrawal evidence is incomplete; emergency and urgent current indicators still override observation.
- `reduce`, `abstain`, and permission-sensitive `unknown` fail closed to `medical_assessment_advised` when required critical evidence is unknown.
- Emergency precedence outranks urgent; urgent outranks assessment; lower-severity evidence never downgrades a higher-severity route.
- Exact HEAD must have real GitHub CI `completed/success` before #33 is called complete.

---

## File Map

### Create

- `packages/contracts/src/alcohol/safety.ts` — Alcohol withdrawal evidence, policy, disposition, reason-code and decision Zod contracts/types.
- `packages/contracts/test/alcohol-safety.test.ts` — contract acceptance tests.
- `apps/mobile/src/alcohol/safety/policy.ts` — frozen V1 policy, canonical key groups, sealing and integrity validation.
- `apps/mobile/src/alcohol/safety/withdrawal-risk.ts` — pure deterministic evaluator and fail-closed runtime boundary.
- `apps/mobile/src/alcohol/safety/index.ts` — Alcohol safety public exports for mobile composition.
- `apps/mobile/test/alcohol-withdrawal-policy.test.ts` — policy integrity/version tests.
- `apps/mobile/test/alcohol-withdrawal-risk.test.ts` — routing precedence, missing-data, determinism and fail-closed tests.
- `apps/mobile/test/alcohol-safety-boundary.test.ts` — source-level isolation/offline architecture guard.

### Modify

- `packages/contracts/src/index.ts` — export Alcohol safety contracts.
- `packages/contracts/test/core-import-boundary.test.ts` — extend Core isolation guard for Alcohol safety symbols.

### Do Not Modify

- `packages/contracts/src/core/*`
- `apps/mobile/src/rescue/*`
- `apps/mobile/src/tobacco/*`
- API/Prisma schema/migrations

---

### Task 1: Alcohol Withdrawal Safety Contracts

**Files:**
- Create: `packages/contracts/src/alcohol/safety.ts`
- Create: `packages/contracts/test/alcohol-safety.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `EventIdSchema` from `packages/contracts/src/ids.ts`.
- Produces: `WithdrawalEvidenceState`, `WithdrawalEvidenceItem`, `AlcoholChangeIntent`, `WithdrawalEvidenceKey`, `WithdrawalRiskEvidence`, `WithdrawalSafetyDisposition`, `WithdrawalSafetyReasonCode`, `WithdrawalRiskPolicy`, `WithdrawalSafetyDecision` and their Zod schemas.

- [ ] **Step 1: Write the failing contract tests**

Create `packages/contracts/test/alcohol-safety.test.ts` with concrete RED expectations:

```ts
import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

const item = (state: 'present' | 'absent' | 'unknown') => ({
  state,
  source: 'self_report' as const,
});

const completeEvidence = {
  changeIntent: 'abstain' as const,
  previousWithdrawalSeizure: item('absent'),
  previousWithdrawalDelirium: item('absent'),
  previousSevereWithdrawal: item('absent'),
  repeatedWithdrawalEpisodes: item('absent'),
  priorMedicallyAssistedWithdrawalComplication: item('absent'),
  currentSeizure: item('absent'),
  severeConfusionOrDisorientation: item('absent'),
  withdrawalSymptomsAfterReduction: item('absent'),
  markedAutonomicSymptoms: item('absent'),
  significantPerceptualDisturbance: item('absent'),
  longDurationHeavyRegularUse: item('absent'),
  morningDrinkingOrReliefDrinking: item('absent'),
  priorWithdrawalSymptomsWhenCuttingDownOrStopping: item('absent'),
  sedativeHypnoticPhysiologicalDependence: item('absent'),
  epilepsy: item('absent'),
  significantUnstableMedicalIllness: item('absent'),
  significantActivePsychiatricIllnessOrCognitiveImpairment: item('absent'),
};

describe('Alcohol withdrawal safety contracts', () => {
  it('exports and accepts tri-state structured withdrawal evidence', () => {
    expect(contracts.WithdrawalRiskEvidenceSchema).toBeDefined();
    expect(contracts.WithdrawalRiskEvidenceSchema.parse(completeEvidence)).toEqual(completeEvidence);
  });

  it('rejects missing evidence fields instead of treating missing as absent', () => {
    const { previousWithdrawalSeizure: _removed, ...incomplete } = completeEvidence;
    expect(() => contracts.WithdrawalRiskEvidenceSchema.parse(incomplete)).toThrow();
  });

  it('accepts only the four frozen product routing dispositions', () => {
    expect(contracts.WithdrawalSafetyDispositionSchema.options).toEqual([
      'behavior_change_support_allowed',
      'medical_assessment_advised',
      'urgent_medical_assessment',
      'emergency_response',
    ]);
  });

  it('validates an auditable decision trace', () => {
    expect(
      contracts.WithdrawalSafetyDecisionSchema.parse({
        engineId: 'alcohol_withdrawal_risk',
        ruleSetId: 'alcohol_withdrawal_risk_v1',
        ruleSetVersion: 1,
        disposition: 'medical_assessment_advised',
        reasonCodes: ['history.previous_withdrawal_seizure'],
        evaluatedEvidenceKeys: ['previousWithdrawalSeizure'],
        unknownCriticalEvidenceKeys: [],
        decidedAt: '2026-09-17T02:30:00.000Z',
      }),
    ).toBeDefined();
  });
});
```

- [ ] **Step 2: Run only the contract test and verify RED**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-safety.test.ts
```

Expected: FAIL because `WithdrawalRiskEvidenceSchema`, `WithdrawalSafetyDispositionSchema`, and `WithdrawalSafetyDecisionSchema` are not exported yet. Existing contract tests must remain green.

- [ ] **Step 3: Add the strict Zod contracts**

Create `packages/contracts/src/alcohol/safety.ts`. Use these exact evidence keys and no catch-all fields:

```ts
import { z } from 'zod';
import { EventIdSchema } from '../ids';

export const WithdrawalEvidenceStateSchema = z.enum(['present', 'absent', 'unknown']);
export const WithdrawalEvidenceSourceSchema = z.enum(['self_report', 'recorded_history', 'derived_local']);

export const WithdrawalEvidenceItemSchema = z
  .object({
    state: WithdrawalEvidenceStateSchema,
    source: WithdrawalEvidenceSourceSchema,
    observedAt: z.string().datetime().optional(),
    evidenceEventIds: z.array(EventIdSchema).min(1).optional(),
  })
  .strict();

export const AlcoholChangeIntentSchema = z.enum(['observe', 'reduce', 'abstain', 'unknown']);

export const WithdrawalEvidenceKeySchema = z.enum([
  'previousWithdrawalSeizure',
  'previousWithdrawalDelirium',
  'previousSevereWithdrawal',
  'repeatedWithdrawalEpisodes',
  'priorMedicallyAssistedWithdrawalComplication',
  'currentSeizure',
  'severeConfusionOrDisorientation',
  'withdrawalSymptomsAfterReduction',
  'markedAutonomicSymptoms',
  'significantPerceptualDisturbance',
  'longDurationHeavyRegularUse',
  'morningDrinkingOrReliefDrinking',
  'priorWithdrawalSymptomsWhenCuttingDownOrStopping',
  'sedativeHypnoticPhysiologicalDependence',
  'epilepsy',
  'significantUnstableMedicalIllness',
  'significantActivePsychiatricIllnessOrCognitiveImpairment',
]);

export const WithdrawalRiskEvidenceSchema = z
  .object({
    changeIntent: AlcoholChangeIntentSchema,
    previousWithdrawalSeizure: WithdrawalEvidenceItemSchema,
    previousWithdrawalDelirium: WithdrawalEvidenceItemSchema,
    previousSevereWithdrawal: WithdrawalEvidenceItemSchema,
    repeatedWithdrawalEpisodes: WithdrawalEvidenceItemSchema,
    priorMedicallyAssistedWithdrawalComplication: WithdrawalEvidenceItemSchema,
    currentSeizure: WithdrawalEvidenceItemSchema,
    severeConfusionOrDisorientation: WithdrawalEvidenceItemSchema,
    withdrawalSymptomsAfterReduction: WithdrawalEvidenceItemSchema,
    markedAutonomicSymptoms: WithdrawalEvidenceItemSchema,
    significantPerceptualDisturbance: WithdrawalEvidenceItemSchema,
    longDurationHeavyRegularUse: WithdrawalEvidenceItemSchema,
    morningDrinkingOrReliefDrinking: WithdrawalEvidenceItemSchema,
    priorWithdrawalSymptomsWhenCuttingDownOrStopping: WithdrawalEvidenceItemSchema,
    sedativeHypnoticPhysiologicalDependence: WithdrawalEvidenceItemSchema,
    epilepsy: WithdrawalEvidenceItemSchema,
    significantUnstableMedicalIllness: WithdrawalEvidenceItemSchema,
    significantActivePsychiatricIllnessOrCognitiveImpairment: WithdrawalEvidenceItemSchema,
  })
  .strict();

export const WithdrawalSafetyDispositionSchema = z.enum([
  'behavior_change_support_allowed',
  'medical_assessment_advised',
  'urgent_medical_assessment',
  'emergency_response',
]);

export const WithdrawalSafetyReasonCodeSchema = z.enum([
  'emergency.current_seizure',
  'emergency.severe_confusion',
  'urgent.marked_autonomic_symptoms',
  'urgent.significant_perceptual_disturbance',
  'history.previous_withdrawal_seizure',
  'history.previous_withdrawal_delirium',
  'history.repeated_withdrawal',
  'history.previous_severe_withdrawal',
  'history.prior_assisted_withdrawal_complication',
  'risk.withdrawal_symptoms_after_reduction',
  'risk.sedative_hypnotic_dependence',
  'risk.epilepsy',
  'risk.unstable_medical_illness',
  'risk.active_psychiatric_or_cognitive_concern',
  'risk.heavy_regular_use_pattern',
  'risk.morning_or_relief_drinking',
  'risk.prior_symptoms_on_reduction',
  'insufficient.required_evidence_unknown',
  'system.invalid_rule_set',
  'system.invalid_evidence',
]);

export const WithdrawalRiskPolicySchema = z
  .object({
    engineId: z.literal('alcohol_withdrawal_risk'),
    ruleSetId: z.string().min(1),
    ruleSetVersion: z.number().int().positive(),
    emergencyEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    urgentEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    assessmentEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    criticalEvidenceKeys: z.array(WithdrawalEvidenceKeySchema).min(1),
    contentHash: z.string().regex(/^fnv1a32:v1:[0-9a-f]{8}$/),
  })
  .strict();

export const WithdrawalSafetyDecisionSchema = z
  .object({
    engineId: z.literal('alcohol_withdrawal_risk'),
    ruleSetId: z.string().min(1),
    ruleSetVersion: z.number().int().positive(),
    disposition: WithdrawalSafetyDispositionSchema,
    reasonCodes: z.array(WithdrawalSafetyReasonCodeSchema),
    evaluatedEvidenceKeys: z.array(WithdrawalEvidenceKeySchema),
    unknownCriticalEvidenceKeys: z.array(WithdrawalEvidenceKeySchema),
    decidedAt: z.string().datetime(),
  })
  .strict();

export type WithdrawalEvidenceState = z.infer<typeof WithdrawalEvidenceStateSchema>;
export type WithdrawalEvidenceItem = z.infer<typeof WithdrawalEvidenceItemSchema>;
export type AlcoholChangeIntent = z.infer<typeof AlcoholChangeIntentSchema>;
export type WithdrawalEvidenceKey = z.infer<typeof WithdrawalEvidenceKeySchema>;
export type WithdrawalRiskEvidence = z.infer<typeof WithdrawalRiskEvidenceSchema>;
export type WithdrawalSafetyDisposition = z.infer<typeof WithdrawalSafetyDispositionSchema>;
export type WithdrawalSafetyReasonCode = z.infer<typeof WithdrawalSafetyReasonCodeSchema>;
export type WithdrawalRiskPolicy = z.infer<typeof WithdrawalRiskPolicySchema>;
export type WithdrawalSafetyDecision = z.infer<typeof WithdrawalSafetyDecisionSchema>;
```

Modify `packages/contracts/src/index.ts` by adding:

```ts
export * from './alcohol/safety';
```

- [ ] **Step 4: Run contract test, typecheck and lint**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-safety.test.ts
pnpm --filter @untrava/contracts typecheck
pnpm --filter @untrava/contracts lint
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/contracts/src/alcohol/safety.ts packages/contracts/src/index.ts packages/contracts/test/alcohol-safety.test.ts
git commit -m "feat: define alcohol withdrawal safety contracts"
```

---

### Task 2: Frozen V1 Policy Bundle and Integrity Validation

**Files:**
- Create: `apps/mobile/src/alcohol/safety/policy.ts`
- Create: `apps/mobile/test/alcohol-withdrawal-policy.test.ts`

**Interfaces:**
- Consumes: `WithdrawalRiskPolicySchema`, `WithdrawalRiskPolicy`, `WithdrawalEvidenceKey`.
- Produces: `ALCOHOL_WITHDRAWAL_RISK_POLICY_V1`, `hasValidWithdrawalRiskPolicyIntegrity(candidate: unknown): candidate is WithdrawalRiskPolicy`.

- [ ] **Step 1: Write policy RED tests**

Create `apps/mobile/test/alcohol-withdrawal-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
  hasValidWithdrawalRiskPolicyIntegrity,
} from '../src/alcohol/safety/policy';

describe('Alcohol withdrawal V1 policy', () => {
  it('pins the frozen V1 rule identity and key groups', () => {
    expect(ALCOHOL_WITHDRAWAL_RISK_POLICY_V1.engineId).toBe('alcohol_withdrawal_risk');
    expect(ALCOHOL_WITHDRAWAL_RISK_POLICY_V1.ruleSetId).toBe('alcohol_withdrawal_risk_v1');
    expect(ALCOHOL_WITHDRAWAL_RISK_POLICY_V1.ruleSetVersion).toBe(1);
    expect(ALCOHOL_WITHDRAWAL_RISK_POLICY_V1.emergencyEvidenceKeys).toEqual([
      'currentSeizure',
      'severeConfusionOrDisorientation',
    ]);
    expect(ALCOHOL_WITHDRAWAL_RISK_POLICY_V1.urgentEvidenceKeys).toEqual([
      'markedAutonomicSymptoms',
      'significantPerceptualDisturbance',
    ]);
  });

  it('detects policy tampering', () => {
    expect(hasValidWithdrawalRiskPolicyIntegrity(ALCOHOL_WITHDRAWAL_RISK_POLICY_V1)).toBe(true);
    expect(
      hasValidWithdrawalRiskPolicyIntegrity({
        ...ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
        assessmentEvidenceKeys: ['longDurationHeavyRegularUse'],
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-withdrawal-policy.test.ts
```

Expected: FAIL because the Alcohol safety policy module does not exist.

- [ ] **Step 3: Implement the canonical V1 policy and checksum**

Create `apps/mobile/src/alcohol/safety/policy.ts`. Reuse the repository's existing stable-value/FNV-1a32 pattern from Rescue library integrity without refactoring Rescue itself.

The frozen arrays must be exactly:

```ts
const emergencyEvidenceKeys = [
  'currentSeizure',
  'severeConfusionOrDisorientation',
] as const;

const urgentEvidenceKeys = [
  'markedAutonomicSymptoms',
  'significantPerceptualDisturbance',
] as const;

const assessmentEvidenceKeys = [
  'withdrawalSymptomsAfterReduction',
  'previousWithdrawalSeizure',
  'previousWithdrawalDelirium',
  'previousSevereWithdrawal',
  'repeatedWithdrawalEpisodes',
  'priorMedicallyAssistedWithdrawalComplication',
  'longDurationHeavyRegularUse',
  'morningDrinkingOrReliefDrinking',
  'priorWithdrawalSymptomsWhenCuttingDownOrStopping',
  'sedativeHypnoticPhysiologicalDependence',
  'epilepsy',
  'significantUnstableMedicalIllness',
  'significantActivePsychiatricIllnessOrCognitiveImpairment',
] as const;

const criticalEvidenceKeys = [
  'currentSeizure',
  'severeConfusionOrDisorientation',
  'withdrawalSymptomsAfterReduction',
  'previousWithdrawalSeizure',
  'previousWithdrawalDelirium',
  'longDurationHeavyRegularUse',
  'morningDrinkingOrReliefDrinking',
  'priorWithdrawalSymptomsWhenCuttingDownOrStopping',
  'sedativeHypnoticPhysiologicalDependence',
  'epilepsy',
  'significantUnstableMedicalIllness',
  'significantActivePsychiatricIllnessOrCognitiveImpairment',
] as const;
```

Use stable key ordering and FNV-1a32:

```ts
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function checksum(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:v1:${hash.toString(16).padStart(8, '0')}`;
}
```

Build the canonical policy with `contentHash` computed over the object with `contentHash` omitted. `hasValidWithdrawalRiskPolicyIntegrity` must first `safeParse` with `WithdrawalRiskPolicySchema`, then recompute the checksum and require exact equality.

- [ ] **Step 4: Run policy tests and mobile typecheck**

```bash
pnpm --filter @untrava/mobile test -- alcohol-withdrawal-policy.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/mobile/src/alcohol/safety/policy.ts apps/mobile/test/alcohol-withdrawal-policy.test.ts
git commit -m "feat: add versioned alcohol withdrawal policy"
```

---

### Task 3: Deterministic Withdrawal Risk Evaluator

**Files:**
- Create: `apps/mobile/src/alcohol/safety/withdrawal-risk.ts`
- Create: `apps/mobile/src/alcohol/safety/index.ts`
- Create: `apps/mobile/test/alcohol-withdrawal-risk.test.ts`

**Interfaces:**
- Consumes: `WithdrawalRiskEvidenceSchema`, `WithdrawalSafetyDecisionSchema`, policy from Task 2.
- Produces: `evaluateWithdrawalRisk(evidenceCandidate: unknown, decidedAt: string, policyCandidate?: unknown): WithdrawalSafetyDecision`.

- [ ] **Step 1: Write RED tests for precedence and intent behavior**

Create a complete all-absent fixture and explicit tests for each route:

```ts
import { describe, expect, it } from 'vitest';
import { ALCOHOL_WITHDRAWAL_RISK_POLICY_V1, evaluateWithdrawalRisk } from '../src/alcohol/safety';

const state = (value: 'present' | 'absent' | 'unknown') => ({
  state: value,
  source: 'self_report' as const,
});

const baseEvidence = (changeIntent: 'observe' | 'reduce' | 'abstain' | 'unknown' = 'abstain') => ({
  changeIntent,
  previousWithdrawalSeizure: state('absent'),
  previousWithdrawalDelirium: state('absent'),
  previousSevereWithdrawal: state('absent'),
  repeatedWithdrawalEpisodes: state('absent'),
  priorMedicallyAssistedWithdrawalComplication: state('absent'),
  currentSeizure: state('absent'),
  severeConfusionOrDisorientation: state('absent'),
  withdrawalSymptomsAfterReduction: state('absent'),
  markedAutonomicSymptoms: state('absent'),
  significantPerceptualDisturbance: state('absent'),
  longDurationHeavyRegularUse: state('absent'),
  morningDrinkingOrReliefDrinking: state('absent'),
  priorWithdrawalSymptomsWhenCuttingDownOrStopping: state('absent'),
  sedativeHypnoticPhysiologicalDependence: state('absent'),
  epilepsy: state('absent'),
  significantUnstableMedicalIllness: state('absent'),
  significantActivePsychiatricIllnessOrCognitiveImpairment: state('absent'),
});

const decidedAt = '2026-09-17T02:45:00.000Z';

describe('evaluateWithdrawalRisk', () => {
  it('routes a current seizure to emergency regardless of intent or lower-level evidence', () => {
    const evidence = {
      ...baseEvidence('observe'),
      currentSeizure: state('present'),
      previousWithdrawalSeizure: state('present'),
    };
    const decision = evaluateWithdrawalRisk(evidence, decidedAt);
    expect(decision.disposition).toBe('emergency_response');
    expect(decision.reasonCodes).toContain('emergency.current_seizure');
  });

  it('routes marked autonomic symptoms to urgent assessment', () => {
    const decision = evaluateWithdrawalRisk(
      { ...baseEvidence('observe'), markedAutonomicSymptoms: state('present') },
      decidedAt,
    );
    expect(decision.disposition).toBe('urgent_medical_assessment');
    expect(decision.reasonCodes).toEqual(['urgent.marked_autonomic_symptoms']);
  });

  it('requires medical assessment for severe withdrawal history before abstinence', () => {
    const decision = evaluateWithdrawalRisk(
      { ...baseEvidence('abstain'), previousWithdrawalSeizure: state('present') },
      decidedAt,
    );
    expect(decision.disposition).toBe('medical_assessment_advised');
    expect(decision.reasonCodes).toEqual(['history.previous_withdrawal_seizure']);
  });

  it('does not block factual observation from historical risk alone', () => {
    const decision = evaluateWithdrawalRisk(
      { ...baseEvidence('observe'), previousWithdrawalSeizure: state('present') },
      decidedAt,
    );
    expect(decision.disposition).toBe('behavior_change_support_allowed');
  });

  it('fails closed on critical unknown evidence for reduction', () => {
    const decision = evaluateWithdrawalRisk(
      { ...baseEvidence('reduce'), previousWithdrawalSeizure: state('unknown') },
      decidedAt,
    );
    expect(decision.disposition).toBe('medical_assessment_advised');
    expect(decision.reasonCodes).toContain('insufficient.required_evidence_unknown');
    expect(decision.unknownCriticalEvidenceKeys).toEqual(['previousWithdrawalSeizure']);
  });

  it('allows ordinary support only with no higher-precedence match and complete required evidence', () => {
    expect(evaluateWithdrawalRisk(baseEvidence('abstain'), decidedAt).disposition).toBe(
      'behavior_change_support_allowed',
    );
  });

  it('is deterministic for the same evidence, policy and timestamp', () => {
    const evidence = baseEvidence('abstain');
    expect(evaluateWithdrawalRisk(evidence, decidedAt)).toEqual(evaluateWithdrawalRisk(evidence, decidedAt));
  });
});
```

- [ ] **Step 2: Run evaluator tests and verify RED**

```bash
pnpm --filter @untrava/mobile test -- alcohol-withdrawal-risk.test.ts
```

Expected: FAIL because `evaluateWithdrawalRisk` and `apps/mobile/src/alcohol/safety/index.ts` do not exist.

- [ ] **Step 3: Implement deterministic evaluator with canonical ordering**

Create a fixed evidence-to-reason map in `withdrawal-risk.ts`:

```ts
const reasonByEvidenceKey = {
  currentSeizure: 'emergency.current_seizure',
  severeConfusionOrDisorientation: 'emergency.severe_confusion',
  markedAutonomicSymptoms: 'urgent.marked_autonomic_symptoms',
  significantPerceptualDisturbance: 'urgent.significant_perceptual_disturbance',
  withdrawalSymptomsAfterReduction: 'risk.withdrawal_symptoms_after_reduction',
  previousWithdrawalSeizure: 'history.previous_withdrawal_seizure',
  previousWithdrawalDelirium: 'history.previous_withdrawal_delirium',
  previousSevereWithdrawal: 'history.previous_severe_withdrawal',
  repeatedWithdrawalEpisodes: 'history.repeated_withdrawal',
  priorMedicallyAssistedWithdrawalComplication: 'history.prior_assisted_withdrawal_complication',
  longDurationHeavyRegularUse: 'risk.heavy_regular_use_pattern',
  morningDrinkingOrReliefDrinking: 'risk.morning_or_relief_drinking',
  priorWithdrawalSymptomsWhenCuttingDownOrStopping: 'risk.prior_symptoms_on_reduction',
  sedativeHypnoticPhysiologicalDependence: 'risk.sedative_hypnotic_dependence',
  epilepsy: 'risk.epilepsy',
  significantUnstableMedicalIllness: 'risk.unstable_medical_illness',
  significantActivePsychiatricIllnessOrCognitiveImpairment:
    'risk.active_psychiatric_or_cognitive_concern',
} as const;
```

The evaluator order must be:

```text
read hard emergency/urgent indicators safely
→ validate full evidence
→ validate policy integrity
→ emergency present? return emergency
→ urgent present? return urgent
→ for reduce/abstain/unknown: assessment evidence present? return assessment
→ for reduce/abstain/unknown: critical unknowns? return assessment
→ otherwise allow ordinary support
```

Use policy-array order to produce deterministic `reasonCodes`, `evaluatedEvidenceKeys`, and `unknownCriticalEvidenceKeys`. Never sort by locale or object insertion order at runtime when the policy already defines canonical order.

Create `apps/mobile/src/alcohol/safety/index.ts`:

```ts
export * from './policy';
export * from './withdrawal-risk';
```

- [ ] **Step 4: Run evaluator, policy and typecheck suites**

```bash
pnpm --filter @untrava/mobile test -- alcohol-withdrawal-risk.test.ts alcohol-withdrawal-policy.test.ts
pnpm --filter @untrava/mobile typecheck
pnpm --filter @untrava/mobile lint
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/mobile/src/alcohol/safety/index.ts apps/mobile/src/alcohol/safety/withdrawal-risk.ts apps/mobile/test/alcohol-withdrawal-risk.test.ts
git commit -m "feat: evaluate alcohol withdrawal risk deterministically"
```

---

### Task 4: Fail-Closed Corruption Handling and Hard Safety Fallback

**Files:**
- Modify: `apps/mobile/src/alcohol/safety/withdrawal-risk.ts`
- Modify: `apps/mobile/test/alcohol-withdrawal-risk.test.ts`

**Interfaces:**
- Preserves Task 3 signature.
- Adds no server/network dependency and no new external library.

- [ ] **Step 1: Add RED tests for invalid policy/evidence**

Append these cases:

```ts
it('fails closed when the policy bundle is tampered', () => {
  const tamperedPolicy = {
    ...ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
    assessmentEvidenceKeys: ['longDurationHeavyRegularUse'],
  };
  const decision = evaluateWithdrawalRisk(baseEvidence('abstain'), decidedAt, tamperedPolicy);
  expect(decision.disposition).toBe('medical_assessment_advised');
  expect(decision.reasonCodes).toEqual(['system.invalid_rule_set']);
});

it('preserves emergency routing even when the policy bundle is invalid', () => {
  const tamperedPolicy = {
    ...ALCOHOL_WITHDRAWAL_RISK_POLICY_V1,
    urgentEvidenceKeys: ['previousWithdrawalSeizure'],
  };
  const decision = evaluateWithdrawalRisk(
    { ...baseEvidence('observe'), currentSeizure: state('present') },
    decidedAt,
    tamperedPolicy,
  );
  expect(decision.disposition).toBe('emergency_response');
  expect(decision.reasonCodes).toEqual(['emergency.current_seizure']);
});

it('preserves urgent routing from safely readable current evidence even if another field is malformed', () => {
  const malformed = {
    ...baseEvidence('observe'),
    markedAutonomicSymptoms: state('present'),
    previousWithdrawalSeizure: { state: 'not-a-state', source: 'self_report' },
  };
  const decision = evaluateWithdrawalRisk(malformed, decidedAt);
  expect(decision.disposition).toBe('urgent_medical_assessment');
  expect(decision.reasonCodes).toEqual(['urgent.marked_autonomic_symptoms']);
});

it('fails closed on malformed evidence when no hard emergency or urgent signal can be trusted', () => {
  const malformed = { ...baseEvidence('abstain'), epilepsy: null };
  const decision = evaluateWithdrawalRisk(malformed, decidedAt);
  expect(decision.disposition).toBe('medical_assessment_advised');
  expect(decision.reasonCodes).toEqual(['system.invalid_evidence']);
});
```

- [ ] **Step 2: Run and verify RED on at least one corruption case**

```bash
pnpm --filter @untrava/mobile test -- alcohol-withdrawal-risk.test.ts
```

Expected: at least one new corruption/fallback test fails before the minimal implementation is added.

- [ ] **Step 3: Implement safe hard-signal extraction before full parse**

Add a narrow helper that reads only the four hard current indicators without trusting the rest of the object:

```ts
function readCandidateState(candidate: unknown, key: string): unknown {
  if (!candidate || typeof candidate !== 'object') return undefined;
  const item = (candidate as Record<string, unknown>)[key];
  if (!item || typeof item !== 'object') return undefined;
  return (item as Record<string, unknown>).state;
}
```

Before full evidence/policy validation:

1. If `currentSeizure` or `severeConfusionOrDisorientation` is exactly `'present'`, return `emergency_response` using frozen hard fallback rule identity `alcohol_withdrawal_risk_v1` / version `1`.
2. Else if `markedAutonomicSymptoms` or `significantPerceptualDisturbance` is exactly `'present'`, return `urgent_medical_assessment`.
3. Then parse full evidence.
4. If evidence parse fails, return `medical_assessment_advised` + `system.invalid_evidence`.
5. Validate policy integrity. If invalid/missing, return `medical_assessment_advised` + `system.invalid_rule_set`.
6. Continue normal versioned evaluation.

The fallback must never return `behavior_change_support_allowed` from malformed data.

- [ ] **Step 4: Re-run focused and full mobile tests**

```bash
pnpm --filter @untrava/mobile test -- alcohol-withdrawal-risk.test.ts alcohol-withdrawal-policy.test.ts
pnpm --filter @untrava/mobile test
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/mobile/src/alcohol/safety/withdrawal-risk.ts apps/mobile/test/alcohol-withdrawal-risk.test.ts
git commit -m "test: fail closed on alcohol safety corruption"
```

---

### Task 5: Core, Rescue and Tobacco Isolation Guards

**Files:**
- Create: `apps/mobile/test/alcohol-safety-boundary.test.ts`
- Modify: `packages/contracts/test/core-import-boundary.test.ts`

**Interfaces:**
- Produces no runtime API.
- Prevents architectural regression after #33.

- [ ] **Step 1: Extend the existing Core boundary characterization test**

Add these tokens to `forbiddenCoreTokens` in `packages/contracts/test/core-import-boundary.test.ts`:

```ts
'/alcohol/safety',
'WithdrawalRiskEvidenceSchema',
'WithdrawalSafetyDecisionSchema',
'alcohol_withdrawal_risk',
'previousWithdrawalSeizure',
```

This is an architecture characterization test; it is expected to remain GREEN immediately because Core currently has no Alcohol safety dependency. Do not create an artificial production failure.

- [ ] **Step 2: Add a mobile source-boundary test**

Create `apps/mobile/test/alcohol-safety-boundary.test.ts` using the existing `import.meta.glob(..., { eager: true, query: '?raw', import: 'default' })` pattern:

```ts
import { describe, expect, it } from 'vitest';

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options: { eager: true; query: '?raw'; import: 'default' },
    ): Record<string, T>;
  }
}

const forbidden = [
  '/alcohol/safety',
  'WithdrawalRiskEvidence',
  'WithdrawalSafetyDecision',
  'alcohol_withdrawal_risk',
  'previousWithdrawalSeizure',
] as const;

describe('Alcohol safety module boundary', () => {
  it('keeps Alcohol withdrawal semantics out of generic Rescue and Tobacco source', () => {
    const sources = {
      ...import.meta.glob<string>('../src/rescue/*.ts', {
        eager: true,
        query: '?raw',
        import: 'default',
      }),
      ...import.meta.glob<string>('../src/tobacco/**/*.ts', {
        eager: true,
        query: '?raw',
        import: 'default',
      }),
    };

    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const [path, source] of Object.entries(sources)) {
      for (const token of forbidden) {
        expect(source, `${path} must not contain ${token}`).not.toContain(token);
      }
    }
  });

  it('keeps the withdrawal evaluator offline and AI-independent', () => {
    const source = import.meta.glob<string>('../src/alcohol/safety/withdrawal-risk.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    const text = Object.values(source).join('\n');
    expect(text).not.toContain('fetch(');
    expect(text).not.toContain('axios');
    expect(text).not.toContain('OpenAI');
    expect(text).not.toContain('chat.completions');
  });
});
```

- [ ] **Step 3: Run isolation tests**

```bash
pnpm --filter @untrava/contracts test -- core-import-boundary.test.ts
pnpm --filter @untrava/mobile test -- alcohol-safety-boundary.test.ts
```

Expected: PASS. If either test fails, remove the dependency/literal from Core/Generic Rescue/Tobacco rather than weakening the guard.

- [ ] **Step 4: Commit Task 5**

```bash
git add packages/contracts/test/core-import-boundary.test.ts apps/mobile/test/alcohol-safety-boundary.test.ts
git commit -m "test: enforce alcohol withdrawal safety boundaries"
```

---

### Task 6: Full #33 Verification and Exact-HEAD CI Gate

**Files:**
- No new production files expected.
- Modify only a #33 file if verification exposes a real defect.

**Interfaces:**
- Produces the final evidence that roadmap item #33 is complete.

- [ ] **Step 1: Run focused contract/mobile suites**

```bash
pnpm --filter @untrava/contracts test -- alcohol-safety.test.ts core-import-boundary.test.ts
pnpm --filter @untrava/mobile test -- alcohol-withdrawal-policy.test.ts alcohol-withdrawal-risk.test.ts alcohol-safety-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run workspace verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all workspace packages PASS.

- [ ] **Step 3: Verify Prisma checks remain unaffected**

Run the same Prisma validation/deploy/generate commands exercised by CI against the test database, or rely on the repository CI job for the authoritative Prisma result. #33 must not add a schema migration.

Expected: existing migration deploy, client generation and schema validation all PASS with zero new migration.

- [ ] **Step 4: Confirm branch scope before final CI claim**

Verify:

```bash
git status --short
git log --oneline --decorate -8
git diff main...HEAD -- packages/contracts/src/core apps/mobile/src/rescue apps/mobile/src/tobacco
```

Expected: no #33 runtime modifications inside Core, generic Rescue, or Tobacco. Only the two intended boundary-test changes may mention those directories indirectly.

- [ ] **Step 5: Verify exact HEAD in GitHub Actions**

Push/commit any final real fix first, record the exact `rescue-interventions` HEAD SHA, and inspect the CI run for that same SHA.

Required evidence before completion:

```text
head_sha == exact branch HEAD
status == completed
conclusion == success
Lint == success
Typecheck == success
Test == success
Validate Prisma schema == success
```

Do not call #33 complete while the exact HEAD job is queued or in progress.

- [ ] **Step 6: Completion report**

Report only after the exact-HEAD gate is green:

```text
#33 complete
- contracts: tri-state withdrawal evidence + decision trace
- policy: frozen/versioned/integrity checked
- engine: deterministic emergency > urgent > assessment > allow precedence
- fail-closed: missing/invalid evidence and invalid policy cannot unlock self-guided change
- observe: factual logging preserved unless hard urgent/emergency evidence overrides
- isolation: Core/Generic Rescue/Tobacco contain no Alcohol withdrawal logic
- exact HEAD SHA: <actual SHA>
- CI run/check: <actual IDs>, completed/success
- main/VDS untouched
```

No work on roadmap item #34 begins in this plan.
