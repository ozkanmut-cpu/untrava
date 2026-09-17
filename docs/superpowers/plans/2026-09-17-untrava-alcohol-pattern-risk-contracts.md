# UNTRAVA Alcohol Pattern/Risk Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement roadmap item #37 as validated Alcohol-owned data contracts for associative pattern insights and bounded near-term behavioral risk assessments, with explicit provenance/missingness and a hard separation from medical withdrawal safety.

**Architecture:** Add one focused `packages/contracts/src/alcohol/pattern-risk.ts` module. Both derived-output schemas share a strict provenance schema; pattern semantics stay association/trend-only, while near-term risk exposes only behavioral targets and cannot carry medical/withdrawal dispositions. The package root exports the schemas/types, and Vitest contract tests prove cross-field invariants and the Safety boundary.

**Tech Stack:** TypeScript 5.9, Zod 4.1, Vitest 3, pnpm workspace, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-untrava-alcohol-pattern-risk-engine-design.md`

## Global Constraints

- Work only on branch `rescue-interventions`; do not merge or modify `main` without explicit user approval.
- Do not use UNTRAVA production/VDS infrastructure; do not touch `srv.field-maintenance-prod.com` or `/opt/field-maintenance/app`.
- #37 is contract-only: no inference engine, ML/statistical scoring, UI, notifications, Rescue automation, plan mutation, support contact, or #38–#40 behavior.
- `AlcoholNearTermRiskAssessment` is behavioral vulnerability only; it is not AUD, dependence, withdrawal, intoxication, Wernicke, medication-interaction, medical-vulnerability, detox-permission, or medical-clearance output.
- Existing Alcohol Safety / `WithdrawalSafetyDecision` remains independent and higher priority; Pattern/Risk must never weaken or override it.
- Pattern insight semantics are association/concentration/trend only and must not encode unsupported causality.
- Canonical source events, goals, plans, Rescue history, Recovery history, and Safety decisions remain immutable from these contracts.
- Missingness is explicit; `unknown` behavioral risk is distinct from baseline risk.
- Both derived outputs carry engine/rule-set/version, evidence window, evidence event IDs, confidence, missingness, missing input keys, and `computedAt` through one shared provenance schema.
- Tests follow RED → observed expected failure → minimal GREEN → full regression → exact-SHA CI `completed/success`.
- Do not call a commit/milestone GREEN while CI is `queued` or `in_progress`.

---

### Task 1: Shared provenance and associative Pattern Insight contract

**Files:**
- Create: `packages/contracts/src/alcohol/pattern-risk.ts`
- Create: `packages/contracts/test/alcohol-pattern-risk.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `EventIdSchema` from `packages/contracts/src/ids.ts`.
- Produces:
  - `AlcoholDerivedConfidenceSchema`
  - `AlcoholDerivedMissingnessSchema`
  - `AlcoholDerivedEvidenceProvenanceSchema`
  - `AlcoholPatternInsightTypeSchema`
  - `AlcoholPatternDirectionSchema`
  - `AlcoholPatternStrengthSchema`
  - `AlcoholPatternInsightSchema`
  - inferred TypeScript types with the corresponding names minus `Schema`.

- [ ] **Step 1: Write RED tests for exports, valid Pattern Insight, strict module/schema identity, provenance windows, uniqueness and missingness.**

Create `packages/contracts/test/alcohol-pattern-risk.test.ts` with the following first-task content:

```ts
import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

interface Schema<T = unknown> {
  parse(value: unknown): T;
}

const patternContracts = contracts as unknown as {
  AlcoholDerivedEvidenceProvenanceSchema?: Schema;
  AlcoholPatternInsightSchema?: Schema;
};

const EVENT_A = '00000000-0000-4000-8000-000000000001';
const EVENT_B = '00000000-0000-4000-8000-000000000002';

const validProvenance = {
  engineId: 'alcohol_pattern_rules',
  ruleSetId: 'alcohol_pattern_rules_v1',
  ruleSetVersion: 1,
  windowStart: '2026-09-10T00:00:00.000Z',
  windowEnd: '2026-09-17T00:00:00.000Z',
  evidenceEventIds: [EVENT_A, EVENT_B],
  confidence: 'medium',
  missingness: 'partial',
  missingInputKeys: ['triggerTags'],
  computedAt: '2026-09-17T01:00:00.000Z',
} as const;

const validPattern = {
  schemaVersion: 1,
  moduleId: 'alcohol',
  insightId: 'pattern-friday-evening',
  insightType: 'day_of_week_concentration',
  direction: 'concentrated',
  strength: 'moderate',
  provenance: validProvenance,
} as const;

describe('Alcohol Pattern/Risk contracts — pattern insight', () => {
  it('exports and parses a valid associative pattern insight', () => {
    expect(patternContracts.AlcoholPatternInsightSchema).toBeDefined();
    if (!patternContracts.AlcoholPatternInsightSchema) {
      throw new Error('AlcoholPatternInsightSchema must be exported');
    }

    expect(patternContracts.AlcoholPatternInsightSchema.parse(validPattern)).toEqual(validPattern);
  });

  it('requires schemaVersion=1 and moduleId=alcohol', () => {
    expect(patternContracts.AlcoholPatternInsightSchema).toBeDefined();
    if (!patternContracts.AlcoholPatternInsightSchema) throw new Error('AlcoholPatternInsightSchema must be exported');

    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({ ...validPattern, schemaVersion: 2 }),
    ).toThrow();
    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({ ...validPattern, moduleId: 'tobacco' }),
    ).toThrow();
  });

  it('rejects an inverted provenance window', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema) {
      throw new Error('AlcoholDerivedEvidenceProvenanceSchema must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        windowStart: '2026-09-18T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects duplicate evidence event ids', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema) {
      throw new Error('AlcoholDerivedEvidenceProvenanceSchema must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        evidenceEventIds: [EVENT_A, EVENT_A],
      }),
    ).toThrow();
  });

  it('keeps missingness and missingInputKeys internally consistent', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema) {
      throw new Error('AlcoholDerivedEvidenceProvenanceSchema must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        missingness: 'none',
        missingInputKeys: ['triggerTags'],
      }),
    ).toThrow();

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        missingness: 'substantial',
        missingInputKeys: [],
      }),
    ).toThrow();
  });

  it('rejects duplicate missing input keys and causal/medical extension fields', () => {
    expect(patternContracts.AlcoholDerivedEvidenceProvenanceSchema).toBeDefined();
    expect(patternContracts.AlcoholPatternInsightSchema).toBeDefined();
    if (!patternContracts.AlcoholDerivedEvidenceProvenanceSchema || !patternContracts.AlcoholPatternInsightSchema) {
      throw new Error('Pattern schemas must be exported');
    }

    expect(() =>
      patternContracts.AlcoholDerivedEvidenceProvenanceSchema?.parse({
        ...validProvenance,
        missingInputKeys: ['triggerTags', 'triggerTags'],
      }),
    ).toThrow();

    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({
        ...validPattern,
        causedBy: 'stress',
      }),
    ).toThrow();

    expect(() =>
      patternContracts.AlcoholPatternInsightSchema?.parse({
        ...validPattern,
        withdrawalDisposition: 'behavior_change_support_allowed',
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the targeted test and verify the expected RED failure.**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-pattern-risk.test.ts
```

Expected: Vitest runs the file and fails the first export assertion because `AlcoholPatternInsightSchema` / `AlcoholDerivedEvidenceProvenanceSchema` do not yet exist on `../src/index`.

Do not proceed if the test passes unexpectedly or fails only because of a typo/syntax error.

- [ ] **Step 3: Implement the minimal strict provenance + Pattern Insight schemas.**

Create `packages/contracts/src/alcohol/pattern-risk.ts` with:

```ts
import { z } from 'zod';
import { EventIdSchema } from '../ids';

const hasDuplicates = (values: readonly string[]) => new Set(values).size !== values.length;

export const AlcoholDerivedConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const AlcoholDerivedMissingnessSchema = z.enum(['none', 'partial', 'substantial']);

export const AlcoholDerivedEvidenceProvenanceSchema = z
  .object({
    engineId: z.string().min(1),
    ruleSetId: z.string().min(1),
    ruleSetVersion: z.number().int().positive(),
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    evidenceEventIds: z.array(EventIdSchema).min(1),
    confidence: AlcoholDerivedConfidenceSchema,
    missingness: AlcoholDerivedMissingnessSchema,
    missingInputKeys: z.array(z.string().min(1)),
    computedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.windowStart) > Date.parse(value.windowEnd)) {
      context.addIssue({
        code: 'custom',
        path: ['windowEnd'],
        message: 'windowEnd must be on or after windowStart',
      });
    }

    if (hasDuplicates(value.evidenceEventIds)) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceEventIds'],
        message: 'evidenceEventIds must be unique',
      });
    }

    if (hasDuplicates(value.missingInputKeys)) {
      context.addIssue({
        code: 'custom',
        path: ['missingInputKeys'],
        message: 'missingInputKeys must be unique',
      });
    }

    if (value.missingness === 'none' && value.missingInputKeys.length !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['missingInputKeys'],
        message: 'missingness=none requires no missing input keys',
      });
    }

    if (value.missingness !== 'none' && value.missingInputKeys.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['missingInputKeys'],
        message: 'partial/substantial missingness requires at least one missing input key',
      });
    }
  });

export const AlcoholPatternInsightTypeSchema = z.enum([
  'time_of_day_concentration',
  'day_of_week_concentration',
  'planned_vs_unplanned_trend',
  'plan_exceedance_pattern',
  'social_context_association',
  'first_drink_time_trend',
  'trigger_association',
  'alcohol_free_day_pattern',
  'rescue_outcome_association',
  'total_ethanol_trend',
]);

export const AlcoholPatternDirectionSchema = z.enum([
  'increasing',
  'decreasing',
  'stable',
  'concentrated',
  'associated',
]);

export const AlcoholPatternStrengthSchema = z.enum(['weak', 'moderate', 'strong']);

export const AlcoholPatternInsightSchema = z
  .object({
    schemaVersion: z.literal(1),
    moduleId: z.literal('alcohol'),
    insightId: z.string().min(1),
    insightType: AlcoholPatternInsightTypeSchema,
    direction: AlcoholPatternDirectionSchema,
    strength: AlcoholPatternStrengthSchema,
    provenance: AlcoholDerivedEvidenceProvenanceSchema,
  })
  .strict();

export type AlcoholDerivedConfidence = z.infer<typeof AlcoholDerivedConfidenceSchema>;
export type AlcoholDerivedMissingness = z.infer<typeof AlcoholDerivedMissingnessSchema>;
export type AlcoholDerivedEvidenceProvenance = z.infer<typeof AlcoholDerivedEvidenceProvenanceSchema>;
export type AlcoholPatternInsightType = z.infer<typeof AlcoholPatternInsightTypeSchema>;
export type AlcoholPatternDirection = z.infer<typeof AlcoholPatternDirectionSchema>;
export type AlcoholPatternStrength = z.infer<typeof AlcoholPatternStrengthSchema>;
export type AlcoholPatternInsight = z.infer<typeof AlcoholPatternInsightSchema>;
```

Modify `packages/contracts/src/index.ts` by adding exactly:

```ts
export * from './alcohol/pattern-risk';
```

next to the existing Alcohol exports.

- [ ] **Step 4: Run the targeted test and verify GREEN.**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-pattern-risk.test.ts
```

Expected: all Task 1 tests PASS.

- [ ] **Step 5: Run contracts lint/typecheck regression.**

Run:

```bash
pnpm --filter @untrava/contracts lint
pnpm --filter @untrava/contracts typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit Task 1.**

```bash
git add packages/contracts/src/alcohol/pattern-risk.ts packages/contracts/test/alcohol-pattern-risk.test.ts packages/contracts/src/index.ts
git commit -m "feat: add alcohol pattern insight contracts"
```

- [ ] **Step 7: Verify exact Task 1 SHA in GitHub Actions before declaring Task 1 green.**

Expected: exact commit SHA has `quality` check `status=completed`, `conclusion=success`.

---

### Task 2: Near-term behavioral risk contract and medical-safety boundary

**Files:**
- Modify: `packages/contracts/src/alcohol/pattern-risk.ts`
- Modify: `packages/contracts/test/alcohol-pattern-risk.test.ts`

**Interfaces:**
- Consumes: `AlcoholDerivedEvidenceProvenanceSchema` from Task 1.
- Produces:
  - `AlcoholNearTermRiskTargetSchema`
  - `AlcoholNearTermRiskHorizonSchema`
  - `AlcoholNearTermRiskBandSchema`
  - `AlcoholNearTermRiskAssessmentSchema`
  - inferred TypeScript types with matching names minus `Schema`.
- Must remain independent from `WithdrawalSafetyDecisionSchema`; no Safety schema import is allowed in `pattern-risk.ts`.

- [ ] **Step 1: Extend the test file with RED tests for valid near-term risk, explicit unknown, unique pattern refs, and strict medical-boundary rejection.**

Append inside the existing test file after the first `describe` block:

```ts
const riskContracts = contracts as unknown as {
  AlcoholNearTermRiskBandSchema?: { options: readonly string[] };
  AlcoholNearTermRiskAssessmentSchema?: Schema;
  WithdrawalSafetyDecisionSchema?: Schema;
};

const validRisk = {
  schemaVersion: 1,
  moduleId: 'alcohol',
  assessmentId: 'risk-current-day-1',
  target: 'plan_exceedance',
  horizon: 'current_planning_day',
  riskBand: 'elevated',
  contributingPatternIds: ['pattern-friday-evening'],
  provenance: validProvenance,
} as const;

describe('Alcohol Pattern/Risk contracts — near-term behavioral risk', () => {
  it('exports and parses a valid near-term behavioral risk assessment', () => {
    expect(riskContracts.AlcoholNearTermRiskAssessmentSchema).toBeDefined();
    if (!riskContracts.AlcoholNearTermRiskAssessmentSchema) {
      throw new Error('AlcoholNearTermRiskAssessmentSchema must be exported');
    }

    expect(riskContracts.AlcoholNearTermRiskAssessmentSchema.parse(validRisk)).toEqual(validRisk);
  });

  it('keeps unknown as an explicit risk band distinct from baseline', () => {
    expect(riskContracts.AlcoholNearTermRiskBandSchema).toBeDefined();
    if (!riskContracts.AlcoholNearTermRiskBandSchema) {
      throw new Error('AlcoholNearTermRiskBandSchema must be exported');
    }

    expect(riskContracts.AlcoholNearTermRiskBandSchema.options).toEqual([
      'unknown',
      'baseline',
      'elevated',
      'high',
    ]);

    expect(riskContracts.AlcoholNearTermRiskAssessmentSchema).toBeDefined();
    if (!riskContracts.AlcoholNearTermRiskAssessmentSchema) {
      throw new Error('AlcoholNearTermRiskAssessmentSchema must be exported');
    }

    expect(
      riskContracts.AlcoholNearTermRiskAssessmentSchema.parse({
        ...validRisk,
        riskBand: 'unknown',
        contributingPatternIds: [],
      }),
    ).toBeDefined();
  });

  it('rejects duplicate contributing pattern ids', () => {
    expect(riskContracts.AlcoholNearTermRiskAssessmentSchema).toBeDefined();
    if (!riskContracts.AlcoholNearTermRiskAssessmentSchema) {
      throw new Error('AlcoholNearTermRiskAssessmentSchema must be exported');
    }

    expect(() =>
      riskContracts.AlcoholNearTermRiskAssessmentSchema?.parse({
        ...validRisk,
        contributingPatternIds: ['pattern-a', 'pattern-a'],
      }),
    ).toThrow();
  });

  it('rejects medical and withdrawal routing fields from behavioral risk', () => {
    expect(riskContracts.AlcoholNearTermRiskAssessmentSchema).toBeDefined();
    if (!riskContracts.AlcoholNearTermRiskAssessmentSchema) {
      throw new Error('AlcoholNearTermRiskAssessmentSchema must be exported');
    }

    for (const [field, value] of [
      ['withdrawalDisposition', 'behavior_change_support_allowed'],
      ['medicalDisposition', 'medical_assessment_advised'],
      ['detoxPermission', true],
      ['withdrawalRisk', 'low'],
      ['medicallyCleared', true],
    ] as const) {
      expect(() =>
        riskContracts.AlcoholNearTermRiskAssessmentSchema?.parse({
          ...validRisk,
          [field]: value,
        }),
      ).toThrow();
    }
  });

  it('keeps the existing WithdrawalSafetyDecision as a separate exported contract', () => {
    expect(riskContracts.WithdrawalSafetyDecisionSchema).toBeDefined();
    expect(riskContracts.AlcoholNearTermRiskAssessmentSchema).toBeDefined();
    expect(riskContracts.WithdrawalSafetyDecisionSchema).not.toBe(
      riskContracts.AlcoholNearTermRiskAssessmentSchema,
    );
  });
});
```

- [ ] **Step 2: Run the targeted test and verify the expected RED failure.**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-pattern-risk.test.ts
```

Expected: Task 1 tests remain PASS and the first near-term-risk export assertion FAILS because `AlcoholNearTermRiskAssessmentSchema` is not yet defined.

- [ ] **Step 3: Add the minimal strict near-term behavioral-risk schemas to `pattern-risk.ts`.**

Insert after `AlcoholPatternInsightSchema` and before the type exports:

```ts
export const AlcoholNearTermRiskTargetSchema = z.enum([
  'unplanned_use',
  'plan_exceedance',
  'rescue_need',
]);

export const AlcoholNearTermRiskHorizonSchema = z.enum([
  'next_24_hours',
  'current_planning_day',
]);

export const AlcoholNearTermRiskBandSchema = z.enum([
  'unknown',
  'baseline',
  'elevated',
  'high',
]);

export const AlcoholNearTermRiskAssessmentSchema = z
  .object({
    schemaVersion: z.literal(1),
    moduleId: z.literal('alcohol'),
    assessmentId: z.string().min(1),
    target: AlcoholNearTermRiskTargetSchema,
    horizon: AlcoholNearTermRiskHorizonSchema,
    riskBand: AlcoholNearTermRiskBandSchema,
    contributingPatternIds: z.array(z.string().min(1)),
    provenance: AlcoholDerivedEvidenceProvenanceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (hasDuplicates(value.contributingPatternIds)) {
      context.addIssue({
        code: 'custom',
        path: ['contributingPatternIds'],
        message: 'contributingPatternIds must be unique',
      });
    }
  });
```

Add these inferred types with the existing type exports:

```ts
export type AlcoholNearTermRiskTarget = z.infer<typeof AlcoholNearTermRiskTargetSchema>;
export type AlcoholNearTermRiskHorizon = z.infer<typeof AlcoholNearTermRiskHorizonSchema>;
export type AlcoholNearTermRiskBand = z.infer<typeof AlcoholNearTermRiskBandSchema>;
export type AlcoholNearTermRiskAssessment = z.infer<typeof AlcoholNearTermRiskAssessmentSchema>;
```

Do not import `WithdrawalSafetyDecisionSchema` or any Safety implementation into this module.

- [ ] **Step 4: Run targeted tests and verify GREEN.**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-pattern-risk.test.ts
```

Expected: all Pattern/Risk tests PASS.

- [ ] **Step 5: Run full contracts regression.**

Run:

```bash
pnpm --filter @untrava/contracts lint
pnpm --filter @untrava/contracts typecheck
pnpm --filter @untrava/contracts test
```

Expected: all commands exit 0; existing Alcohol Safety tests remain unchanged and green.

- [ ] **Step 6: Run repository-wide acceptance verification.**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @untrava/api prisma validate
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 2.**

```bash
git add packages/contracts/src/alcohol/pattern-risk.ts packages/contracts/test/alcohol-pattern-risk.test.ts
git commit -m "feat: add alcohol near-term risk contract"
```

- [ ] **Step 8: Verify exact Task 2 SHA in GitHub Actions.**

Expected: exact commit SHA has `quality` check `status=completed`, `conclusion=success`. If CI fails, inspect the first failing step/log and fix only the concrete root cause using another RED→GREEN cycle.

---

## #37 Acceptance Gate

#37 is complete only when all of the following are true:

- `AlcoholPatternInsightSchema` validates the frozen V1 pattern types/directions/strengths.
- `AlcoholNearTermRiskAssessmentSchema` validates only the three behavioral targets and two short horizons from the spec.
- `riskBand` includes explicit `unknown`, separate from `baseline`.
- both outputs use `AlcoholDerivedEvidenceProvenanceSchema`.
- provenance rejects inverted windows, duplicate evidence IDs, duplicate missing keys and inconsistent missingness declarations.
- risk assessments reject duplicate `contributingPatternIds`.
- strict schemas reject causal-extension fields and medical/withdrawal/detox-clearance fields.
- Pattern/Risk code does not import or override Alcohol Safety; `WithdrawalSafetyDecisionSchema` remains separate.
- no inference/scoring engine or #38–#40 scope is introduced.
- targeted contracts tests, full contracts regression and repository-wide verification pass.
- exact final HEAD CI is `completed/success`.

## Self-Review Record

- **Spec coverage:** Sections 1–17 of the #37 spec map to Task 1 (shared provenance + pattern contract) or Task 2 (near-term risk + safety boundary + verification). No inference/UI/automation work is included because the spec explicitly excludes it.
- **Placeholder scan:** no `TBD`, `TODO`, unspecified validation step, or undefined implementation interface remains.
- **Type consistency:** Task 2 consumes exactly `AlcoholDerivedEvidenceProvenanceSchema` and `hasDuplicates` introduced by Task 1; all schema/type names match the approved spec.
